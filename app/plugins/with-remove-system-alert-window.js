/**
 * SYSTEM_ALERT_WINDOW is unused (no overlay / draw-over-apps flow).
 * React Native still injects it from a debug manifest, and it has
 * leaked into release APKs. Mark it tools:node="remove" so the
 * merged release manifest drops it.
 *
 * WRITE_SETTINGS is also removed: brightness gestures use the
 * in-app window brightness API, not system brightness, so this
 * permission is not needed even if expo-brightness's plugin
 * auto-applies it.
 */
const { withAndroidManifest } = require("expo/config-plugins");

const REMOVE = [
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.WRITE_SETTINGS",
];

function withRemoveUnusedPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ || {};
    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    const existing = manifest["uses-permission"] || [];
    const kept = existing.filter((entry) => {
      const name = entry.$?.["android:name"];
      return !REMOVE.includes(name);
    });
    for (const name of REMOVE) {
      kept.push({
        $: {
          "android:name": name,
          "tools:node": "remove",
        },
      });
    }
    manifest["uses-permission"] = kept;
    return config;
  });
}

module.exports = withRemoveUnusedPermissions;
