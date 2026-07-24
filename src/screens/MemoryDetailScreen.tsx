import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { deleteMemory, listMemories, type Memory } from "../lib/memoriesApi";
import { ApiError } from "../lib/apiError";
import { impactLight, impactMedium } from "../lib/haptics";
import type { MemoriesStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type Nav = NativeStackNavigationProp<MemoriesStackParamList, "MemoryDetail">;
type DetailRoute = RouteProp<MemoriesStackParamList, "MemoryDetail">;

function formatMemoryDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { dateStyle: "medium" });
}

// Isolated so useVideoPlayer only ever mounts for an actual video memory --
// MemoryDetailScreen itself can't call the hook conditionally.
function MemoryVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={styles.media} contentFit="contain" nativeControls />;
}

export default function MemoryDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const { memoryId } = route.params;
  const { session } = useAuth();
  const canManage = Boolean(session?.sections.includes("memories"));

  const [memory, setMemory] = useState<Memory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // No single-memory GET endpoint -- same workaround as Tasks/Applications/
  // Events/Members: fetch the list and find this one by id.
  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const memories = await listMemories();
      const found = memories.data.find((m) => m.id === memoryId) ?? null;
      setMemory(found);
      if (!found) {
        setLoadError("This memory couldn't be found -- it may have been removed.");
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load this memory.");
    } finally {
      setIsLoading(false);
    }
  }, [memoryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleDelete() {
    if (!memory) return;
    Alert.alert("Delete memory", "Delete this photo or video? This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          impactMedium();
          setActionError(null);
          setIsDeleting(true);
          deleteMemory(memoryId)
            .then(() => navigation.goBack())
            .catch((err: unknown) => {
              setActionError(err instanceof ApiError ? err.message : "That didn't go through. Try again.");
              setIsDeleting(false);
            });
        },
      },
    ]);
  }

  if (isLoading && !memory) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.lilac.default} />
      </View>
    );
  }

  if (!memory) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? "Memory not found."}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.mediaWrap}>
        {memory.mediaType === "video" ? (
          <MemoryVideoPlayer uri={memory.imageUrl} />
        ) : (
          <Image source={{ uri: memory.imageUrl }} style={styles.media} contentFit="cover" transition={200} />
        )}
      </View>

      <View style={styles.body}>
        {memory.title ? <Text style={styles.title}>{memory.title}</Text> : null}
        {memory.caption ? <Text style={styles.caption}>{memory.caption}</Text> : null}
        <Text style={styles.date}>{formatMemoryDate(memory.publishedAt ?? memory.createdAt)}</Text>

        {canManage ? (
          <View style={styles.buttonRow}>
            <Pressable
              style={styles.editButton}
              onPress={() => {
                impactLight();
                navigation.navigate("EditMemory", { memory });
              }}
              disabled={isDeleting}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={isDeleting}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
        ) : null}

        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, padding: 24 },
  container: { backgroundColor: colors.ink, flexGrow: 1 },
  mediaWrap: { width: "100%", aspectRatio: 1, backgroundColor: colors.surfaceRaised },
  media: { width: "100%", height: "100%" },
  body: { padding: 20 },
  title: { fontFamily: typography.display, fontSize: 20, color: colors.parchment },
  caption: { fontFamily: typography.body, fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: 8 },
  date: { fontFamily: typography.mono, fontSize: 12, color: colors.muted, marginTop: 12 },
  errorText: { fontFamily: typography.body, color: colors.candle.default, fontSize: 14, marginTop: 16, textAlign: "center" },
  buttonRow: { flexDirection: "row", gap: 16, marginTop: 24 },
  editButton: {
    borderWidth: 1,
    borderColor: colors.lilac.default,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  editButtonText: { fontFamily: typography.bodySemibold, color: colors.lilac.default, fontSize: 14 },
  deleteButton: { paddingVertical: 8, paddingHorizontal: 4 },
  deleteButtonText: { fontFamily: typography.bodySemibold, color: colors.candle.default, fontSize: 14 },
});
