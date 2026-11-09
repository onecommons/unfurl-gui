// onlyRemoveTypeImports matches tsconfig's verbatimModuleSyntax: an import
// without `type` is kept. allowDeclareFields makes `declare x` the only field
// Babel erases, as swc does in the fork.
const typescript = {onlyRemoveTypeImports: true, allowDeclareFields: true}

const defaultEnv = {
  presets: [
    "@vue/cli-plugin-babel/preset",
    "@babel/preset-env",
    // by file extension, so .ts files only
    ["@babel/preset-typescript", typescript],
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
  },
  overrides: [{
    // A <script lang="ts"> block reaches Babel named after its .vue file, which
    // the extension check above skips, and Babel cannot see the block's lang.
    // So every .vue script parses as TypeScript; for plain JS that is the same.
    test: /\.vue$/,
    presets: [["@babel/preset-typescript", {...typescript, allExtensions: true}]],
  }],
};
