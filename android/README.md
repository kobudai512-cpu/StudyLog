# Winkle Study Android companion

Android 12+ (min SDK 31), target SDK 36. Java/platform APIs only; no third-party runtime dependencies.

## Build

Open this directory in Android Studio, or set JAVA_HOME to JDK 21+ and ANDROID_HOME to an SDK containing Android 36, then run:

```sh
./gradlew assembleDebug lintDebug
./gradlew assembleDebugAndroidTest
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w app.winkle.study.test/app.winkle.study.WidgetTests
```

The instrumentation runner checks Android Keystore encryption, races with replacement keys, weekly/goal rendering, rollover and revocation. Run under both `adb shell cmd uimode night yes` and `no`. It writes a widget screenshot into the debug application's private files directory. It uses synthetic data and removes it afterwards. Tests do not ship in the release APK.

## Release

Create ignored `signing.properties` containing `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`. Never commit signing keys or credentials. Run `./gradlew assembleRelease`, verify with Android SDK `apksigner verify`, and copy `app/build/outputs/apk/release/app-release.apk` to `../public/downloads/winkle-study.apk` before building the website. Increment versionCode and versionName for upgrades.

The initial signing key is stored outside this repository under the owner's `.android/winkle-signing` directory. Keep a private backup: future APK upgrades require the same key.

Certificate SHA-256: `8060c5b5c16b1fed4cf267b6e36cf85b98172f968faf72637481b1da337a9649`.

## Data and behavior

- Pair on the authenticated website at /widget. The server retains only a SHA-256 hash of a random 256-bit read-only key in a durable, independent widget namespace. Rotation invalidates the previous key; revocation is checked before and after Notion synchronization.
- The app encrypts its key with an Android Keystore AES-GCM key. Backup and device transfer exclude private settings. It sends Bearer credentials only to the fixed HTTPS production origin, without redirects, and never logs them.
- The summary contains only the current Tokyo Monday–Sunday period, total minutes, valid weekly target, sync time and stale status. It does not expose record text, subjects, Notion URLs or credentials.
- The widget refreshes approximately every 30 minutes through AppWidgetProvider and JobScheduler. OS battery/network policies may delay refresh. Manual refresh uses the same background job. Cached data is labelled with its original timestamp; previous-week totals are hidden after rollover. Server revocation clears local data on the next successful connection; offline devices may retain their last display until then.
- Widgets and adaptive icons have black/white day/night resources. The monochrome adaptive layer lets launchers apply their themed icon palette. Chrome home-screen shortcuts cannot guarantee the same themed behavior; use this installed app's launcher icon.
- Website URL is fixed to https://winkle-study.vercel.app in StudyWidget.java. Change it deliberately if hosting moves.
