module.exports = {
  env: {
    "": {
      presets: [
        "@vue/cli-plugin-babel/preset",
      ],
    },
    test: {
      presets: [

        "@babel/preset-env",
        "@babel/preset-typescript"
        // ['@babel/preset-env', {targets: {node: 'current'}, useBuiltIns: 'usage', corejs: 3}],
        // '@babel/preset-typescript',
      ],
      plugins: [
        "@babel/plugin-transform-runtime",
        // [
        //   "@babel/plugin-transform-runtime",
        //   {
        //     "corejs": 3,
        //     regenerator: true
        //   }
        // ]
      ]
    }
  }
};
