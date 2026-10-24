// iOS 27 stops any app at launch that doesn't use the scene life cycle. Expo ships the scene delegate
// (EXExpoAppSceneDelegate, named in app.json's UIApplicationSceneManifest) but the SDK 57 template still makes
// the window in AppDelegate. This hands the window to the scene delegate; AppDelegate keeps the React Native factory.
const { withAppDelegate } = require('expo/config-plugins');

const WINDOW_START = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

module.exports = config =>
  withAppDelegate(config, cfg => {
    let src = cfg.modResults.contents;
    if (src.includes('ExpoReactNativeFactoryProvider')) return cfg;
    const cls = 'class AppDelegate: ExpoAppDelegate {';
    if (!src.includes(cls) || !src.includes(WINDOW_START)) {
      throw new Error('scene-lifecycle: AppDelegate.swift no longer matches the SDK 57 template; update plugins/scene-lifecycle.js');
    }
    src = src.replace(cls, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    src = src.replace(WINDOW_START, '    // The scene delegate (EXExpoAppSceneDelegate) makes the window and starts React Native in it.\n');
    cfg.modResults.contents = src;
    return cfg;
  });
