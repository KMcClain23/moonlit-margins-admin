import * as Haptics from "expo-haptics";

/** Floating "+" buttons, primary form submit buttons, swipe-action-row
 * taps, and other everyday action taps. */
export function impactLight(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Reserved for destructive actions (delete, leave), fired only once
 * actually confirmed -- e.g. inside an Alert's destructive button --
 * never on the initial tap that opens the confirmation. */
export function impactMedium(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Switch toggles and segmented filter/tab taps. */
export function selection(): void {
  void Haptics.selectionAsync();
}
