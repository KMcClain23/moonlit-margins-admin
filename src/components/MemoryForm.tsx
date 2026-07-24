import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import DateField from "./DateField";
import { impactLight } from "../lib/haptics";
import { dateToIsoDateString, isoDateStringToDate } from "../lib/dateUtils";
import { uploadMemoryMedia, type Memory, type MemoryInput, type MemoryMediaType } from "../lib/memoriesApi";
import { ApiError } from "../lib/apiError";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export default function MemoryForm({
  initialValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  errorMessage,
}: {
  initialValues?: Memory;
  onSubmit: (input: MemoryInput) => void;
  submitLabel: string;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [mediaUrl, setMediaUrl] = useState(initialValues?.imageUrl ?? "");
  const [mediaType, setMediaType] = useState<MemoryMediaType | null>(initialValues?.mediaType ?? null);
  const [thumbnailUrl, setThumbnailUrl] = useState(initialValues?.thumbnailUrl ?? "");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [caption, setCaption] = useState(initialValues?.caption ?? "");
  const [publishedAt, setPublishedAt] = useState(() =>
    initialValues?.publishedAt ? dateToIsoDateString(new Date(initialValues.publishedAt)) : ""
  );

  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const canSubmit = Boolean(mediaUrl) && !isSubmitting && !isUploadingMedia && !isUploadingThumbnail;

  async function pickMedia(source: "camera-photo" | "camera-video" | "library") {
    const permission =
      source === "library"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setPickError(
        source === "library" ? "Photo library permission is needed to choose one." : "Camera permission is needed."
      );
      return;
    }

    const result =
      source === "camera-photo"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.9 })
        : source === "camera-video"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: "videos" })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.9 });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0]!;
    const pickedType: MemoryMediaType = asset.type === "video" ? "video" : "image";
    const fileName = asset.fileName ?? `memory-${Date.now()}.${pickedType === "video" ? "mp4" : "jpg"}`;
    const fileType = asset.mimeType ?? (pickedType === "video" ? "video/mp4" : "image/jpeg");

    setPickError(null);
    setIsUploadingMedia(true);
    setUploadProgress(0);
    try {
      const publicUrl = await uploadMemoryMedia(asset.uri, fileName, fileType, setUploadProgress);
      setMediaUrl(publicUrl);
      setMediaType(pickedType);
      // A freshly picked photo can't carry over a stale video thumbnail.
      if (pickedType === "image") setThumbnailUrl("");
    } catch (err) {
      setPickError(err instanceof ApiError ? err.message : "Couldn't upload that file.");
    } finally {
      setIsUploadingMedia(false);
    }
  }

  function handleChooseMedia() {
    impactLight();
    Alert.alert("Add photo or video", undefined, [
      { text: "Take Photo", onPress: () => void pickMedia("camera-photo") },
      { text: "Record Video", onPress: () => void pickMedia("camera-video") },
      { text: "Choose from Library", onPress: () => void pickMedia("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function pickThumbnail() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickError("Photo library permission is needed to choose a thumbnail.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.9 });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0]!;
    const fileName = asset.fileName ?? `memory-thumb-${Date.now()}.jpg`;
    const fileType = asset.mimeType ?? "image/jpeg";

    setPickError(null);
    setIsUploadingThumbnail(true);
    try {
      setThumbnailUrl(await uploadMemoryMedia(asset.uri, fileName, fileType));
    } catch (err) {
      setPickError(err instanceof ApiError ? err.message : "Couldn't upload that thumbnail.");
    } finally {
      setIsUploadingThumbnail(false);
    }
  }

  function handleSubmit() {
    impactLight();
    onSubmit({
      imageUrl: mediaUrl,
      thumbnailUrl: thumbnailUrl.trim() || undefined,
      title: title.trim() || undefined,
      caption: caption.trim() || undefined,
      publishedAt: publishedAt ? (isoDateStringToDate(publishedAt)?.toISOString() ?? undefined) : undefined,
    });
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={20}>
      <Text style={styles.label}>Photo or video</Text>
      <View style={styles.mediaPreviewFrame}>
        {isUploadingMedia ? (
          <View style={styles.uploadingBox}>
            <ActivityIndicator color={colors.parchment} />
            <Text style={styles.uploadingText}>
              {uploadProgress > 0 ? `Uploading… ${Math.round(uploadProgress * 100)}%` : "Uploading…"}
            </Text>
          </View>
        ) : mediaUrl ? (
          mediaType === "video" ? (
            <View style={styles.mediaPreviewImage}>
              {thumbnailUrl ? (
                <Image source={{ uri: thumbnailUrl }} style={styles.mediaPreviewImage} contentFit="cover" />
              ) : null}
              <View style={styles.playOverlay}>
                <Ionicons name="play-circle" size={40} color={colors.parchment} />
              </View>
            </View>
          ) : (
            <Image source={{ uri: mediaUrl }} style={styles.mediaPreviewImage} contentFit="cover" transition={200} />
          )
        ) : (
          <Text style={styles.mediaPlaceholderText}>No media selected</Text>
        )}
      </View>

      <Pressable style={styles.chooseButton} onPress={handleChooseMedia} disabled={isSubmitting || isUploadingMedia}>
        <Text style={styles.chooseButtonText}>{mediaUrl ? "Replace photo or video" : "Choose photo or video"}</Text>
      </Pressable>

      {pickError ? <Text style={styles.errorText}>{pickError}</Text> : null}

      {mediaType === "video" ? (
        <>
          <Text style={styles.label}>Thumbnail (optional)</Text>
          <Pressable
            style={styles.chooseButton}
            onPress={pickThumbnail}
            disabled={isSubmitting || isUploadingThumbnail}
          >
            {isUploadingThumbnail ? (
              <ActivityIndicator color={colors.lilac.default} />
            ) : (
              <Text style={styles.chooseButtonText}>{thumbnailUrl ? "Replace thumbnail" : "Choose thumbnail"}</Text>
            )}
          </Pressable>
        </>
      ) : null}

      <Text style={styles.label}>Title (optional)</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        editable={!isSubmitting}
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Caption (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={caption}
        onChangeText={setCaption}
        editable={!isSubmitting}
        placeholderTextColor={colors.muted}
      />

      <View style={styles.dateField}>
        <DateField
          label="Published date (optional)"
          value={publishedAt}
          onChange={setPublishedAt}
          disabled={isSubmitting}
          allowClear
        />
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitButtonText}>{submitLabel}</Text>}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.ink, flexGrow: 1 },
  label: { fontFamily: typography.mono, fontSize: 12, color: colors.muted, marginTop: 18, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.parchment,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  mediaPreviewFrame: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPreviewImage: { width: "100%", height: "100%" },
  mediaPlaceholderText: { fontFamily: typography.body, fontSize: 13, color: colors.muted },
  uploadingBox: { alignItems: "center", gap: 8 },
  uploadingText: { fontFamily: typography.body, fontSize: 13, color: colors.muted },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  chooseButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.lilac.default,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  chooseButtonText: { fontFamily: typography.bodySemibold, color: colors.lilac.default, fontSize: 14 },
  dateField: { marginTop: 4 },
  errorText: { fontFamily: typography.body, color: colors.candle.default, fontSize: 14, marginTop: 16, textAlign: "center" },
  submitButton: {
    backgroundColor: colors.lilac.default,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontFamily: typography.bodySemibold, color: colors.ink, fontSize: 16 },
});
