const defaultEnv = {
  presets: [
    "@vue/cli-plugin-babel/preset",
    "@babel/preset-env",
  ],
  plugins: [
    "@babel/plugin-transform-runtime",
  ]
}

module.exports = {
  env: {
    development: defaultEnv,
    production: defaultEnv,
    test: defaultEnv,
  }
};
