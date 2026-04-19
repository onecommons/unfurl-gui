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
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
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

  plugins: ["graphql"]
};
