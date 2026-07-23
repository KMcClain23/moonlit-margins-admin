import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

function formatDisplayDateTime(date: Date): string {
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

type AndroidStep = "date" | "time" | null;

/**
 * A tap-to-open native date+time picker bound to a full ISO datetime
 * string, used by EventForm's "Starts at" field. Unlike DateField (which
 * only ever needs a calendar day), events need a specific time too.
 *
 * iOS has a single combined mode="datetime" picker. Android's native
 * picker has no such mode -- it only supports "date" or "time" per
 * instance -- so on Android this chains a date picker into a time picker,
 * carrying the picked date forward and merging in the picked time before
 * calling onChange.
 */
export default function DateTimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (isoDateTime: string) => void;
  disabled?: boolean;
}) {
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [androidStep, setAndroidStep] = useState<AndroidStep>(null);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);

  const parsed = value ? new Date(value) : null;
  const selectedDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();

  function openPicker() {
    if (Platform.OS === "android") {
      setPendingDate(selectedDate);
      setAndroidStep("date");
    } else {
      setShowIosPicker(true);
    }
  }

  function handleIosChange(_event: DateTimePickerChangeEvent, date: Date) {
    setShowIosPicker(false);
    onChange(date.toISOString());
  }

  function handleAndroidDateChange(_event: DateTimePickerChangeEvent, date: Date) {
    setPendingDate(date);
    setAndroidStep("time");
  }

  function handleAndroidTimeChange(_event: DateTimePickerChangeEvent, time: Date) {
    const base = pendingDate ?? selectedDate;
    const combined = new Date(base);
    combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    setAndroidStep(null);
    setPendingDate(null);
    onChange(combined.toISOString());
  }

  function handleDismiss() {
    setShowIosPicker(false);
    setAndroidStep(null);
    setPendingDate(null);
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={openPicker} disabled={disabled}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDisplayDateTime(selectedDate) : "Select a date & time"}
        </Text>
      </Pressable>

      {Platform.OS === "ios" && showIosPicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="datetime"
          display="spinner"
          onValueChange={handleIosChange}
          onDismiss={handleDismiss}
        />
      ) : null}

      {Platform.OS === "android" && androidStep === "date" ? (
        <DateTimePicker
          value={pendingDate ?? selectedDate}
          mode="date"
          display="default"
          onValueChange={handleAndroidDateChange}
          onDismiss={handleDismiss}
        />
      ) : null}

      {Platform.OS === "android" && androidStep === "time" ? (
        <DateTimePicker
          value={pendingDate ?? selectedDate}
          mode="time"
          display="default"
          onValueChange={handleAndroidTimeChange}
          onDismiss={handleDismiss}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: typography.mono, fontSize: 12, color: colors.muted, marginBottom: 6 },
  field: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  valueText: { fontFamily: typography.body, fontSize: 15, color: colors.parchment },
  placeholderText: { fontFamily: typography.body, fontSize: 15, color: colors.muted },
});
