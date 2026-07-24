import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../lib/authStore";
import { listMemories, type Memory } from "../lib/memoriesApi";
import { ApiError } from "../lib/apiError";
import { impactLight } from "../lib/haptics";
import { listItemExiting, listItemLayout, staggeredEntering } from "../lib/listAnimations";
import { useNetworkStatus } from "../lib/useNetworkStatus";
import type { MemoriesStackParamList } from "../navigation/RootNavigator";
import { colors, withAlpha } from "../theme/colors";
import { typography } from "../theme/typography";
import EmptyState from "../components/EmptyState";
import OfflineBanner from "../components/OfflineBanner";

type Nav = NativeStackNavigationProp<MemoriesStackParamList, "MemoriesList">;

// A grid "row" item, or a null spacer to keep the last row's tile from
// stretching to full width when the memory count is odd (FlatList's
// numColumns splits each row's real children evenly via flex, but a lone
// child in the final row has nothing to split against).
type GridEntry = Memory | null;

const NUM_COLUMNS = 2;

export default function MemoriesListScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const isOffline = useNetworkStatus();

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);
    try {
      const result = await listMemories();
      setMemories(result.data);
      setIsStale(result.stale);
      setCachedAt(result.cachedAt);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not load memories.");
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const gridData = useMemo<GridEntry[]>(() => {
    const remainder = memories.length % NUM_COLUMNS;
    if (remainder === 0) return memories;
    return [...memories, ...Array(NUM_COLUMNS - remainder).fill(null)];
  }, [memories]);

  return (
    <View style={styles.container}>
      <OfflineBanner visible={isOffline || isStale} cachedAt={cachedAt} />
      {isLoading && memories.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.lilac.default} />
        </View>
      ) : (
        <FlatList
          data={gridData}
          keyExtractor={(item, index) => item?.id ?? `spacer-${index}`}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={memories.length === 0 ? styles.emptyContent : styles.listContent}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => load(true)}
              tintColor={colors.lilac.default}
              colors={[colors.lilac.default]}
            />
          }
          ListEmptyComponent={
            errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : <EmptyState message="No memories yet." />
          }
          renderItem={({ item, index }) => {
            if (!item) return <View style={styles.tileWrap} />;
            const isVideo = item.mediaType === "video";
            const thumbnail = isVideo ? item.thumbnailUrl : item.imageUrl;

            return (
              <Animated.View
                entering={staggeredEntering(index)}
                exiting={listItemExiting}
                layout={listItemLayout}
                style={styles.tileWrap}
              >
                <Pressable style={styles.tile} onPress={() => navigation.navigate("MemoryDetail", { memoryId: item.id })}>
                  {thumbnail ? (
                    <Image source={{ uri: thumbnail }} style={styles.tileImage} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[styles.tileImage, styles.videoPlaceholder]}>
                      <Ionicons name="play-circle" size={40} color={colors.muted} />
                    </View>
                  )}

                  {isVideo ? (
                    <View style={styles.playBadge}>
                      <Ionicons name="play" size={11} color={colors.parchment} />
                    </View>
                  ) : null}

                  {item.title ? (
                    <>
                      <LinearGradient colors={["transparent", withAlpha(colors.ink, 0.85)]} style={styles.gradient} />
                      <Text style={styles.tileTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </>
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          }}
        />
      )}

      {session?.sections.includes("memories") ? (
        <Pressable
          style={styles.fab}
          onPress={() => {
            impactLight();
            navigation.navigate("CreateMemory");
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const GRID_GAP = 12;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16 },
  emptyContent: { flexGrow: 1 },
  row: { gap: GRID_GAP, marginBottom: GRID_GAP },
  errorText: {
    fontFamily: typography.body,
    color: colors.candle.default,
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 40,
  },
  tileWrap: { flex: 1 },
  tile: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tileImage: { width: "100%", height: "100%" },
  videoPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  playBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: withAlpha(colors.ink, 0.6),
    alignItems: "center",
    justifyContent: "center",
  },
  gradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" },
  tileTitle: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 8,
    fontFamily: typography.bodySemibold,
    fontSize: 12,
    color: colors.parchment,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.lilac.default,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: { color: colors.lilac.default, fontSize: 28, lineHeight: 30 },
});
