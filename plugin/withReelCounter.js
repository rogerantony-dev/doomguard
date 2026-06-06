const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const ACCESSIBILITY_CONFIG_RES = "@xml/doomguard_accessibility_config";

/**
 * Wires up the native Reel-counter:
 *  1. Declares SYSTEM_ALERT_WINDOW + the AccessibilityService in the manifest.
 *  2. Copies the Kotlin service and its accessibility config XML into the
 *     generated Android project during prebuild.
 *
 * Kept as a config plugin (rather than a committed android/ tree) so the project
 * stays prebuild- and EAS-friendly.
 */
function withReelCounter(config) {
  config = withReelCounterManifest(config);
  config = withReelCounterNativeFiles(config);
  return config;
}

function withReelCounterManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // Permission: draw the pill over other apps.
    const permissions = manifest.manifest["uses-permission"] || [];
    const hasOverlayPermission = permissions.some(
      (p) => p.$["android:name"] === "android.permission.SYSTEM_ALERT_WINDOW"
    );
    if (!hasOverlayPermission) {
      permissions.push({
        $: { "android:name": "android.permission.SYSTEM_ALERT_WINDOW" },
      });
    }
    manifest.manifest["uses-permission"] = permissions;

    // The AccessibilityService declaration.
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.service = application.service || [];
    const alreadyDeclared = application.service.some(
      (s) => s.$["android:name"] === ".ReelAccessibilityService"
    );
    if (!alreadyDeclared) {
      application.service.push({
        $: {
          "android:name": ".ReelAccessibilityService",
          "android:exported": "false",
          "android:label": "Doomguard Reel Counter",
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.accessibilityservice.AccessibilityService",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": ACCESSIBILITY_CONFIG_RES,
            },
          },
        ],
      });
    }

    return config;
  });
}

function withReelCounterNativeFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidPackage = config.android?.package;
      if (!androidPackage) {
        throw new Error(
          "withReelCounter: expo.android.package must be set in app.json"
        );
      }

      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot; // .../android
      const sourceDir = path.join(projectRoot, "plugin", "native");

      // Kotlin service -> app/src/main/java/<package path>/
      const javaDir = path.join(
        platformRoot,
        "app",
        "src",
        "main",
        "java",
        ...androidPackage.split(".")
      );
      fs.mkdirSync(javaDir, { recursive: true });

      let kotlin = fs.readFileSync(
        path.join(sourceDir, "ReelAccessibilityService.kt"),
        "utf8"
      );
      kotlin = kotlin.replace(
        /^package .*$/m,
        `package ${androidPackage}`
      );
      fs.writeFileSync(
        path.join(javaDir, "ReelAccessibilityService.kt"),
        kotlin
      );

      // Accessibility config -> app/src/main/res/xml/
      const xmlDir = path.join(
        platformRoot,
        "app",
        "src",
        "main",
        "res",
        "xml"
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.copyFileSync(
        path.join(sourceDir, "doomguard_accessibility_config.xml"),
        path.join(xmlDir, "doomguard_accessibility_config.xml")
      );

      return config;
    },
  ]);
}

module.exports = withReelCounter;
