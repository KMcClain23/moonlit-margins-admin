import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  getStoredNotificationPreferences,
  isGlobalPushEnabled,
  saveNotificationPreferences,
  setGlobalPushEnabled,
} from "../lib/pushNotifications";
import { selection } from "../lib/haptics";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export default function MessageSettingsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([isGlobalPushEnabled(), getStoredNotificationPreferences()]).then(([enabled, preferences]) => {
      if (cancelled) return;
      setPushEnabled(enabled);
      setSound(preferences.sound);
      setVibration(preferences.vibration);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePushToggle(next: boolean) {
    selection();
    setPushEnabled(next);
    await setGlobalPushEnabled(next);
  }

  async function handleSoundToggle(next: boolean) {
    selection();
    setSound(next);
    await saveNotificationPreferences({ sound: next, vibration });
  }

  async function handleVibrationToggle(next: boolean) {
    selection();
    setVibration(next);
    await saveNotificationPreferences({ sound, vibration: next });
  }

  if (isLoading) {
    return <View style={styles.scroll} />;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Message notifications</Text>
            <Text style={styles.rowHint}>Push notifications for new messages on this device.</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={(next) => void handlePushToggle(next)}
            trackColor={{ false: colors.surfaceRaised, true: colors.lilac.default }}
            thumbColor={colors.parchment}
          />
        </View>

        <View style={styles.divider} />

        <View style={[styles.row, !pushEnabled && styles.rowDisabled]}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Sound</Text>
          </View>
          <Switch
            value={sound}
            onValueChange={(next) => void handleSoundToggle(next)}
            disabled={!pushEnabled}
            trackColor={{ false: colors.surfaceRaised, true: colors.lilac.default }}
            thumbColor={colors.parchment}
          />
        </View>

        <View style={styles.divider} />

        <View style={[styles.row, !pushEnabled && styles.rowDisabled]}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Vibration</Text>
          </View>
          <Switch
            value={vibration}
            onValueChange={(next) => void handleVibrationToggle(next)}
            disabled={!pushEnabled}
            trackColor={{ false: colors.surfaceRaised, true: colors.lilac.default }}
            thumbColor={colors.parchment}
          />
        </View>
      </View>

      <Text style={styles.footnote}>
        Want to quiet just one conversation instead of all of them? Swipe a conversation in the Messages list and
        tap Mute.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.ink },
  container: { flexGrow: 1, padding: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 16,
  },
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: typography.bodySemibold, fontSize: 15, color: colors.parchment },
  rowHint: { fontFamily: typography.body, fontSize: 12, color: colors.muted, marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  footnote: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: 16,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
});
