/**
 * Bumps the two version identifiers app.json needs to bump together for
 * every new native APK build (local or cloud):
 *   - android.versionCode (integer) -- must strictly increase for Android
 *     to treat a new install as an update rather than a downgrade/conflict.
 *   - version (semver "x.y.z", PATCH bumped) -- with runtimeVersion.policy
 *     set to "appVersion" in app.json, this is also what partitions OTA
 *     update compatibility, so it has to change on every native rebuild
 *     too, not just versionCode.
 *
 * Run via `npm run prebuild:local` / `npm run build:local` (see
 * package.json) before a LOCAL build. For a CLOUD build (`eas build`),
 * eas.json's "autoIncrement": true makes EAS bump versionCode remotely on
 * its own -- this script's versionCode half becomes redundant in that
 * path -- but nothing on the EAS side bumps the semver `version` field.
 * Run `node scripts/bump-version.js` (or accept the redundant versionCode
 * bump, it's harmless) before a cloud build too, or OTA updates published
 * against the new native build will carry the same runtimeVersion as the
 * previous one.
 */
const fs = require("fs");
const path = require("path");

const APP_JSON_PATH = path.join(__dirname, "..", "app.json");

function bumpPatch(version) {
  const parts = version.split(".").map(Number);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join(".");
}

function main() {
  const raw = fs.readFileSync(APP_JSON_PATH, "utf8");
  const config = JSON.parse(raw);

  if (!config.expo.android) config.expo.android = {};

  const oldVersionCode = config.expo.android.versionCode ?? 0;
  const newVersionCode = oldVersionCode + 1;

  const oldVersion = config.expo.version;
  const newVersion = bumpPatch(oldVersion);

  config.expo.android.versionCode = newVersionCode;
  config.expo.version = newVersion;

  fs.writeFileSync(APP_JSON_PATH, JSON.stringify(config, null, 2) + "\n");

  console.log(`android.versionCode: ${oldVersionCode} -> ${newVersionCode}`);
  console.log(`version: ${oldVersion} -> ${newVersion}`);
}

main();
