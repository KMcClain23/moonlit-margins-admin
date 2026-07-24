import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { uploadMemberPhoto } from "../lib/membersApi";
import { ApiError } from "../lib/apiError";
import { impactLight } from "../lib/haptics";
import { clampOffset, clampZoom, getAvatarPhotoStyle } from "../utils/photoCrop";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

const FRAME_SIZE = 140;

const AnimatedImage = Animated.createAnimatedComponent(Image);

export interface PhotoPositionerValue {
  photoUrl: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

interface PhotoPositionerProps {
  photoUrl: string | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
  disabled?: boolean;
  onChange: (next: PhotoPositionerValue) => void;
}

/**
 * Interactive zoom/pan editor for a member's photo, matching the web
 * admin's drag-to-reposition behavior exactly (same offset formula, same
 * "commit only on gesture release" philosophy for a smooth 60fps drag).
 * zoom/offsetX/offsetY are fully parent-controlled -- this component only
 * mirrors them into Reanimated shared values for the live gesture, and
 * reports back via onChange once a pinch or pan actually ends.
 */
export default function PhotoPositioner({
  photoUrl,
  zoom,
  offsetX,
  offsetY,
  disabled,
  onChange,
}: PhotoPositionerProps) {
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shown immediately after picking (before the upload resolves) so the
  // frame doesn't sit empty during the round trip -- once onChange fires
  // with the new publicUrl, the photoUrl prop takes back over and this
  // local override is cleared.
  const displayUri = localPreviewUri ?? photoUrl;

  const zoomShared = useSharedValue(zoom);
  const offsetXShared = useSharedValue(offsetX);
  const offsetYShared = useSharedValue(offsetY);

  // Re-syncs the live gesture values whenever the parent-controlled props
  // change from outside a gesture (a freshly uploaded photo resets to
  // zoom 1/offset 0, or the form just loaded an existing member's saved
  // position) -- a harmless no-op the rest of the time, since committing a
  // gesture pushes these exact same values back up as props anyway.
  useEffect(() => {
    zoomShared.value = zoom;
    offsetXShared.value = offsetX;
    offsetYShared.value = offsetY;
  }, [zoom, offsetX, offsetY, zoomShared, offsetXShared, offsetYShared]);

  const commit = useCallback(() => {
    onChange({
      photoUrl: photoUrl ?? "",
      zoom: zoomShared.value,
      offsetX: offsetXShared.value,
      offsetY: offsetYShared.value,
    });
  }, [onChange, photoUrl, zoomShared, offsetXShared, offsetYShared]);

  const gesturesEnabled = Boolean(displayUri) && !disabled && !isUploading;

  const startZoom = useSharedValue(1);
  const pinchGesture = Gesture.Pinch()
    .enabled(gesturesEnabled)
    .onBegin(() => {
      startZoom.value = zoomShared.value;
    })
    .onUpdate((event) => {
      const nextZoom = clampZoom(startZoom.value * event.scale);
      zoomShared.value = nextZoom;
      offsetXShared.value = clampOffset(offsetXShared.value, nextZoom);
      offsetYShared.value = clampOffset(offsetYShared.value, nextZoom);
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const startOffsetX = useSharedValue(0);
  const startOffsetY = useSharedValue(0);
  const panGesture = Gesture.Pan()
    .enabled(gesturesEnabled)
    .onBegin(() => {
      startOffsetX.value = offsetXShared.value;
      startOffsetY.value = offsetYShared.value;
    })
    .onUpdate((event) => {
      const z = zoomShared.value;
      // Divided by (FRAME_SIZE * zoom), matching getAvatarPhotoStyle's own
      // zoom-scaled translate, so the photo tracks the finger 1:1 in screen
      // pixels at any zoom level rather than drifting faster than the drag.
      const nextOffsetX = clampOffset(startOffsetX.value + (event.translationX / (FRAME_SIZE * z)) * 100, z);
      const nextOffsetY = clampOffset(startOffsetY.value + (event.translationY / (FRAME_SIZE * z)) * 100, z);
      offsetXShared.value = nextOffsetX;
      offsetYShared.value = nextOffsetY;
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedImageStyle = useAnimatedStyle(
    () => getAvatarPhotoStyle(FRAME_SIZE, zoomShared.value, offsetXShared.value, offsetYShared.value).image
  );

  async function pickFrom(source: "camera" | "library") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        source === "camera"
          ? "Camera permission is needed to take a photo."
          : "Photo library permission is needed to choose one."
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.9 });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0]!;
    const fileName = asset.fileName ?? `member-${Date.now()}.jpg`;
    const fileType = asset.mimeType ?? "image/jpeg";

    setError(null);
    setLocalPreviewUri(asset.uri);
    setIsUploading(true);
    try {
      const publicUrl = await uploadMemberPhoto(asset.uri, fileName, fileType);
      // A genuinely new photo shouldn't inherit whatever crop was set on
      // the old one -- matches the web form's same reset-on-replace behavior.
      onChange({ photoUrl: publicUrl, zoom: 1, offsetX: 0, offsetY: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that photo.");
      setLocalPreviewUri(null);
    } finally {
      setIsUploading(false);
    }
  }

  function handleChoosePhoto() {
    impactLight();
    Alert.alert("Choose photo", undefined, [
      { text: "Take Photo", onPress: () => void pickFrom("camera") },
      { text: "Choose from Library", onPress: () => void pickFrom("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.container}>
      {displayUri ? (
        <GestureDetector gesture={composedGesture}>
          <View style={styles.frame}>
            <AnimatedImage source={{ uri: displayUri }} style={animatedImageStyle} contentFit="cover" />
            {isUploading ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color={colors.parchment} />
              </View>
            ) : null}
          </View>
        </GestureDetector>
      ) : (
        <View style={[styles.frame, styles.placeholder]}>
          <Text style={styles.placeholderText}>No photo</Text>
        </View>
      )}

      <View style={styles.controls}>
        <Text style={styles.hint}>Pinch to zoom, drag to reposition.</Text>
        <Pressable style={styles.chooseButton} onPress={handleChoosePhoto} disabled={disabled || isUploading}>
          <Text style={styles.chooseButtonText}>Choose Photo</Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: FRAME_SIZE / 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  placeholder: { alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  placeholderText: { fontFamily: typography.mono, fontSize: 11, color: colors.muted },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 10, 20, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  controls: { flex: 1, gap: 8, paddingTop: 4 },
  hint: { fontFamily: typography.body, fontSize: 12, color: colors.muted, lineHeight: 17 },
  chooseButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.lilac.default,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chooseButtonText: { fontFamily: typography.bodySemibold, color: colors.lilac.default, fontSize: 13 },
  errorText: { fontFamily: typography.body, color: colors.candle.default, fontSize: 12 },
});
