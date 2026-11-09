module.exports = {
  root: true,

  env: {
    node: true
  },

  extends: [
    "plugin:vue/essential",
    // XXX the code shared with gitlab-oc should use the same lints
    // disabling because they generate too much noise
    // "plugin:@gitlab/i18n",
    // "eslint:recommended",
    // "@vue/typescript/recommended",
    // "@vue/prettier",
    // "@vue/prettier/@typescript-eslint"
  ],

  parserOptions: {
    ecmaVersion: 2020
  },
  rules: {
    semi: 'off', // XXX [1]
    "vue/multi-word-component-names": "off",
    "vue/no-v-text-v-html-on-component": "off",
    // warn/error/assert are diagnostics we want to keep; console.log is not
    "no-console":
      process.env.NODE_ENV === "production"
        ? ["warn", { allow: ["warn", "error", "assert"] }]
        : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    /*
    "graphql/template-strings": [
      "error",
      {
        env: "literal",
        projectName: "app",
        schemaJsonFilepath: "graphql/schema.json"
      }
    ],
      */
    "@typescript-eslint/no-explicit-any": "off"
  },

  plugins: ["graphql"],

  overrides: [
    {
      files: ["*.ts"],
      // The vue rules need vue-eslint-parser on top; it hands the script to
      // the TS parser. v6 is the last line that supports eslint 7; it
      // predates TS 5.9 but parses it. Resolved from the repo root: by name it
      // finds oc-pages' own nested 2.x, which cannot parse TS 4+ syntax.
      parserOptions: {
        parser: require.resolve("@typescript-eslint/parser", {paths: [`${__dirname}/../..`]}),
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    {
      // <script lang="ts"> to the same parser; plain <script> keeps the default
      files: ["*.vue"],
      parserOptions: {
        parser: {
          ts: require.resolve("@typescript-eslint/parser", {paths: [`${__dirname}/../..`]}),
        },
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
  ],
};
