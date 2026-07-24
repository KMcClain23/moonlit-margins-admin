module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Required for react-native-reanimated (a peer dependency of
    // react-native-keyboard-controller's KeyboardProvider) to compile its
    // worklets -- must be listed last per reanimated's own setup docs.
    plugins: ["react-native-reanimated/plugin"],
  };
};
