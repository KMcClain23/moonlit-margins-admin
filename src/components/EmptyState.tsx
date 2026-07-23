import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Starfield from "./Starfield";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

/** The "nothing here yet" message for a list screen, with a subtle
 * starfield behind it for a bit of atmosphere instead of a flat blank
 * background. Not for loading/error states -- just the true empty case. */
export default function EmptyState({ message }: { message: string }) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <Starfield variant="subtle" width={width} height={height} style={styles.starfield} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  starfield: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  message: { fontFamily: typography.body, fontSize: 15, color: colors.muted },
});
