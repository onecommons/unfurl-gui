module.exports = {
  root: true,

  env: {
    node: true,
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
    ecmaVersion: 2020,
    parser: "babel-eslint",
  },
  rules: {
    // warn/error/assert are diagnostics we want to keep; console.log is not
    "no-console":
      process.env.NODE_ENV === "production"
        ? ["warn", { allow: ["warn", "error", "assert"] }]
        : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "semi": "off",
    // "graphql/template-strings": [
    //   "warn", //eslint hates me
    //   {
    //     env: "literal",
    //     projectName: "app",
    //     schemaJsonFilepath: "graphql/schema.json"
    //   }
    // ],
    // "@typescript-eslint/no-explicit-any": "off"
  },

};
