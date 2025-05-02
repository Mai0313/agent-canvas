module.exports = {
  presets: ["react-app"],
  plugins: [
    [require.resolve("@babel/plugin-transform-unicode-property-regex"), { useUnicodeFlag: true }],
  ],
};
