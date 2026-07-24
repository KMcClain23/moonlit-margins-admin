import { FadeInDown, FadeOutUp, LinearTransition } from "react-native-reanimated";

// Capped so a long list's later rows don't wait ages to appear -- the
// stagger reads as intentional for the first screenful, then rows past
// that just fade in together with the last visible delay.
const MAX_STAGGER_INDEX = 8;
const STAGGER_MS = 40;

/** Per-row entrance for FlatList items -- a subtle staggered fade + slide
 * up when a list first loads. Pass the row's FlatList index. */
export function staggeredEntering(index: number) {
  return FadeInDown.delay(Math.min(index, MAX_STAGGER_INDEX) * STAGGER_MS)
    .springify()
    .damping(18);
}

/** Row removal (e.g. "Leave" dropping a conversation from the list). */
export const listItemExiting = FadeOutUp.springify().damping(18);

/** Smooths a row's position shift when neighboring rows are added/removed. */
export const listItemLayout = LinearTransition.springify();
