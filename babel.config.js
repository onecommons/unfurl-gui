const defaultEnv = {
  presets: [
    "@vue/cli-plugin-babel/preset",
    "@babel/preset-env",
    // Applies to .ts files only. onlyRemoveTypeImports matches tsconfig's
    // verbatimModuleSyntax: an import without `type` is kept. allowDeclareFields
    // makes `declare x` the only field Babel erases, as swc does in the fork.
    ["@babel/preset-typescript", {onlyRemoveTypeImports: true, allowDeclareFields: true}],
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
