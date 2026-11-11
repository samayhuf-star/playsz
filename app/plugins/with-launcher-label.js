/**
 * Set the Android home-screen label to the short name "Playsz"
 * while expo.name stays the full store name.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

function withLauncherLabel(config) {
  return withAndroidManifest(config, (config) => {
    const applications = config.modResults.manifest.application || [];
    for (const application of applications) {
      application.$ = application.$ || {};
      application.$["android:label"] = "Playsz";
    }
    return config;
  });
}

module.exports = withLauncherLabel;
