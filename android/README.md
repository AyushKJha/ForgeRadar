# ForgeRadar for Android

This Android app opens the existing protected ForgeRadar website at `https://forgeradar.onrender.com/` in a contained WebView. It uses the same workshop account and live laptop worker. When the laptop worker is off, the dashboard can load but local AI, project builds and private previews remain offline. The app does not bundle a local model or publish project sites.

## Build

Install JDK 17, the Android SDK platform 36 and build tools 36.0.0, and Gradle 9.6.0. Open this `android` folder in Android Studio or run `gradle :app:assembleDebug` from it. The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`. Android SDK licenses must be accepted by the person installing the SDK. No paid service is required.

## Security and scope

The WebView loads only HTTPS pages on `forgeradar.onrender.com`. Other HTTPS links open in the device browser. Cleartext, local files, content URIs, mixed content, third-party cookies, backups and WebView debugging are disabled. Login cookies are managed by Android WebView and are not stored in this repository. The site retains its own session and API authorization checks. This is a mobile shell for the website, not a native offline implementation. It should be tested on an Android device before distribution.

The debug APK is for device testing. A distributable release requires a user-controlled signing key, a review of the live login and preview flows, and any app distribution requirements applicable to the user's device and region.
