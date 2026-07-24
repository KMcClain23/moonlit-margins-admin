import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { listMembers, TIER_LABELS, type Member, type MemberTier } from "../lib/membersApi";
import { ApiError } from "../lib/apiError";
import { impactLight } from "../lib/haptics";
import { listItemExiting, listItemLayout, staggeredEntering } from "../lib/listAnimations";
import { useNetworkStatus } from "../lib/useNetworkStatus";
import { getAvatarPhotoStyle } from "../utils/photoCrop";
import type { MembersStackParamList } from "../navigation/RootNavigator";
import { colors, withAlpha } from "../theme/colors";
import { typography } from "../theme/typography";
import EmptyState from "../components/EmptyState";
import OfflineBanner from "../components/OfflineBanner";
import SkeletonRow from "../components/SkeletonRow";

const SKELETON_ROWS = Array.from({ length: 5 }, (_, i) => i);
const AVATAR_SIZE = 44;

const TIER_COLORS: Record<MemberTier, string> = {
  founder: colors.lilac.default,
  council: colors.lilac.soft,
  junior_council: colors.candle.soft,
  member: colors.muted,
};

type Nav = NativeStackNavigationProp<MembersStackParamList, "MembersList">;

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export default function MembersListScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
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
      const result = await listMembers();
      setMembers(result.data);
      setIsStale(result.stale);
      setCachedAt(result.cachedAt);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not load members.");
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

  return (
    <View style={styles.container}>
      <OfflineBanner visible={isOffline || isStale} cachedAt={cachedAt} />
      {isLoading && members.length === 0 ? (
        <View style={styles.listContent}>
          {SKELETON_ROWS.map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={members.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => load(true)}
              tintColor={colors.lilac.default}
              colors={[colors.lilac.default]}
            />
          }
          ListEmptyComponent={
            errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : <EmptyState message="No members yet." />
          }
          renderItem={({ item, index }) => {
            const avatarLayout = getAvatarPhotoStyle(AVATAR_SIZE, item.photoZoom, item.photoOffsetX, item.photoOffsetY);
            return (
              <Animated.View entering={staggeredEntering(index)} exiting={listItemExiting} layout={listItemLayout}>
                <Pressable style={styles.row} onPress={() => navigation.navigate("MemberDetail", { memberId: item.id })}>
                  <View style={styles.avatarFrame}>
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={avatarLayout.image} contentFit="cover" transition={200} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitials}>{getInitials(item.fullName)}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.rowText}>
                    <Text style={styles.name}>{item.fullName}</Text>
                    {item.role ? <Text style={styles.role}>{item.role}</Text> : null}
                  </View>

                  <View style={[styles.badge, { backgroundColor: withAlpha(TIER_COLORS[item.tier], 0.15) }]}>
                    <Text style={[styles.badgeText, { color: TIER_COLORS[item.tier] }]}>{TIER_LABELS[item.tier]}</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          }}
        />
      )}

      {session?.sections.includes("members") ? (
        <Pressable
          style={styles.fab}
          onPress={() => {
            impactLight();
            navigation.navigate("CreateMember");
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  listContent: { padding: 16 },
  emptyContent: { flexGrow: 1 },
  errorText: {
    fontFamily: typography.body,
    color: colors.candle.default,
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  avatarFrame: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
  },
  avatarPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontFamily: typography.bodySemibold, fontSize: 15, color: colors.lilac.soft },
  rowText: { flex: 1 },
  name: { fontFamily: typography.bodySemibold, fontSize: 16, color: colors.parchment },
  role: { fontFamily: typography.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: typography.mono, fontSize: 11 },
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
