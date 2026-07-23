import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { dateToIsoDateString, isoDateStringToDate } from "../lib/dateUtils";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * A tap-to-open native date picker bound to an ISO "YYYY-MM-DD" string,
 * shared by CreateTaskScreen's due-date field and TaskDetailScreen's
 * propose-new-date field. Selecting a date closes the picker immediately
 * on both platforms -- Android's dialog already behaves this way natively;
 * mirroring it on iOS keeps the two consistent instead of leaving iOS's
 * inline picker open until some other action closes it.
 */
export default function DateField({
  label,
  value,
  onChange,
  disabled,
  minimumDate,
  allowClear = false,
}: {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  minimumDate?: Date;
  allowClear?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate = isoDateStringToDate(value) ?? minimumDate ?? new Date();

  function handleValueChange(_event: DateTimePickerChangeEvent, date: Date) {
    setShowPicker(false);
    onChange(dateToIsoDateString(date));
  }

  function handleDismiss() {
    setShowPicker(false);
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.field, styles.fieldGrow]}
          onPress={() => setShowPicker(true)}
          disabled={disabled}
        >
          <Text style={value ? styles.valueText : styles.placeholderText}>
            {value ? formatDisplayDate(selectedDate) : "Select a date"}
          </Text>
        </Pressable>
        {allowClear && value ? (
          <Pressable style={styles.clearButton} onPress={() => onChange("")} disabled={disabled}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {showPicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
          minimumDate={minimumDate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: typography.mono, fontSize: 12, color: colors.muted, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  field: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  fieldGrow: { flex: 1 },
  valueText: { fontFamily: typography.body, fontSize: 15, color: colors.parchment },
  placeholderText: { fontFamily: typography.body, fontSize: 15, color: colors.muted },
  clearButton: { paddingHorizontal: 10, paddingVertical: 12 },
  clearButtonText: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.candle.default },
});
