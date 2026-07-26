const {
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
  AndroidConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const ACCESSIBILITY_CONFIG_RES = "@xml/unhook_accessibility_config";

/**
 * Shown under the service name in Settings > Accessibility.
 *
 * Keep these truthful and specific. They are the user-facing justification for
 * a service that can read window content, and Play reviewers read them when
 * assessing an Accessibility API declaration. Avoid apostrophes: strings.xml
 * treats them as escape characters.
 */
const ACCESSIBILITY_SUMMARY =
  "Counts your Reels and Shorts time so Unhook can time or block them.";

const ACCESSIBILITY_DESCRIPTION =
  "Unhook uses this service to tell when Instagram Reels or YouTube Shorts is " +
  "on screen, so it can count the time you spend there and, once you reach the " +
  "daily limit you set, close the feed. It reads screen content only inside " +
  "Instagram and YouTube. Nothing is recorded, and no data leaves your phone.";

/**
 * Wires up the native Reel-counter:
 *  1. Declares SYSTEM_ALERT_WINDOW + the AccessibilityService in the manifest,
 *     plus the home-screen widget receiver.
 *  2. Copies the Kotlin sources, the accessibility config XML, and the widget
 *     resources (layout/drawable/xml) into the generated Android project during
 *     prebuild.
 *
 * Kept as a config plugin (rather than a committed android/ tree) so the project
 * stays prebuild- and EAS-friendly.
 */
function withReelCounter(config) {
  config = withReelCounterManifest(config);
  config = withReelCounterStrings(config);
  config = withReelCounterNativeFiles(config);
  return config;
}

/** The summary/description the accessibility config XML points at. */
function withReelCounterStrings(config) {
  return withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [
        {
          $: { name: "unhook_accessibility_summary" },
          _: ACCESSIBILITY_SUMMARY,
        },
        {
          $: { name: "unhook_accessibility_description" },
          _: ACCESSIBILITY_DESCRIPTION,
        },
      ],
      config.modResults
    );
    return config;
  });
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
          "android:label": "Unhook Reel Counter",
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

    // The home-screen widget receiver (reads the same counts the service writes).
    application.receiver = application.receiver || [];
    const widgetDeclared = application.receiver.some(
      (r) => r.$["android:name"] === ".UnhookWidgetProvider"
    );
    if (!widgetDeclared) {
      application.receiver.push({
        $: {
          "android:name": ".UnhookWidgetProvider",
          // Exported so every launcher's widget host (incl. Samsung One UI)
          // reliably lists + binds the widget.
          "android:exported": "true",
          "android:label": "Unhook",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.appwidget.action.APPWIDGET_UPDATE",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.appwidget.provider",
              "android:resource": "@xml/unhook_widget_info",
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
      const resRoot = path.join(platformRoot, "app", "src", "main", "res");

      // Every Kotlin source -> app/src/main/java/<package path>/, with its
      // package line rewritten to the app's package so R + cross-class refs resolve.
      const javaDir = path.join(
        platformRoot,
        "app",
        "src",
        "main",
        "java",
        ...androidPackage.split(".")
      );
      fs.mkdirSync(javaDir, { recursive: true });

      for (const file of fs.readdirSync(sourceDir)) {
        if (!file.endsWith(".kt")) continue;
        const kotlin = fs
          .readFileSync(path.join(sourceDir, file), "utf8")
          .replace(/^package .*$/m, `package ${androidPackage}`);
        fs.writeFileSync(path.join(javaDir, file), kotlin);
      }

      // Accessibility config -> app/src/main/res/xml/
      const xmlDir = path.join(resRoot, "xml");
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.copyFileSync(
        path.join(sourceDir, "unhook_accessibility_config.xml"),
        path.join(xmlDir, "unhook_accessibility_config.xml")
      );

      // Widget resources (layout/drawable/xml) -> app/src/main/res/<type>/
      const resSource = path.join(sourceDir, "res");
      if (fs.existsSync(resSource)) {
        for (const resType of fs.readdirSync(resSource)) {
          const fromDir = path.join(resSource, resType);
          if (!fs.statSync(fromDir).isDirectory()) continue;
          const toDir = path.join(resRoot, resType);
          fs.mkdirSync(toDir, { recursive: true });
          for (const file of fs.readdirSync(fromDir)) {
            fs.copyFileSync(path.join(fromDir, file), path.join(toDir, file));
          }
        }
      }

      return config;
    },
  ]);
}

module.exports = withReelCounter;
