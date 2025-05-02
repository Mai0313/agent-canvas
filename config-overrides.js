module.exports = function override(config, env) {
  // Find the babel-loader rule
  const babelLoaderRule = config.module.rules
    .find((rule) => rule.oneOf)
    .oneOf.find((rule) => rule.loader && rule.loader.includes("babel-loader"));

  // Add regex transpilation options
  if (babelLoaderRule) {
    if (!babelLoaderRule.options) babelLoaderRule.options = {};
    if (!babelLoaderRule.options.plugins) babelLoaderRule.options.plugins = [];

    // Add the Unicode property regex transform plugin
    babelLoaderRule.options.plugins.push([
      require.resolve("@babel/plugin-transform-unicode-property-regex"),
      { useUnicodeFlag: true },
    ]);
  }

  return config;
};
