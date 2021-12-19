const path = require('path');

// this alias is used by code copied from gitlab
const alias = {
  '~': path.join(__dirname, 'src/assets/javascripts')
}

module.exports = {
  pluginOptions: {
    apollo: {
      enableMocks: true,
      enableEngine: true,
      lintGQL: true
    }
  },
  configureWebpack: {
    resolve: {
      alias,
    }
  },

  pages: {
    index: "src/main.ts",
    dashboard: {
      title: "Unfurl Cloud Dashboard",
      entry: "src/pages/dashboard/index.js"
    }
  }
};


