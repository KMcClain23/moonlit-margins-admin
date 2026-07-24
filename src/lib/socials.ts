import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type SocialPlatformKey = "tiktok" | "instagram" | "facebook" | "goodreads";
export type SocialsMap = Partial<Record<SocialPlatformKey, string>>;

/** Mirrors the web app's src/lib/socials.ts exactly (key/label/placeholder/
 * base) -- these are the only four platforms the web form has fields for,
 * so a member's `socials` JSON never has other keys worth rendering UI for.
 * `icon` has no web equivalent (that side uses react-icons' brand glyphs);
 * Ionicons has logo-tiktok/instagram/facebook but no Goodreads brand mark,
 * so that one falls back to a plain book icon. */
export const SOCIAL_PLATFORMS: {
  key: SocialPlatformKey;
  label: string;
  placeholder: string;
  base: string;
  icon: IoniconName;
}[] = [
  { key: "tiktok", label: "TikTok", placeholder: "@handle", base: "https://www.tiktok.com/@", icon: "logo-tiktok" },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "@handle",
    base: "https://www.instagram.com/",
    icon: "logo-instagram",
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "profile or page name",
    base: "https://www.facebook.com/",
    icon: "logo-facebook",
  },
  {
    key: "goodreads",
    label: "Goodreads",
    placeholder: "profile name or full URL",
    base: "https://www.goodreads.com/",
    icon: "book-outline",
  },
];

/** Accepts either a bare handle (with or without a leading @) or a full URL
 * someone pasted in directly -- Goodreads profiles in particular are often
 * numeric IDs that don't fit a clean "@handle" pattern, so a full-URL
 * escape hatch is worth having for every platform, not just Goodreads.
 * Matches the web app's buildSocialUrl exactly. */
export function buildSocialUrl(base: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${base}${trimmed.replace(/^@/, "")}`;
}
