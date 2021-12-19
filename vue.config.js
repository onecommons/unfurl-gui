const path = require('path');

// this alias is used by code copied from gitlab
const alias = {
  '~': path.join(__dirname, 'src/assets/javascripts'),
  'oc': path.join(__dirname, 'src/pages')
}

const unfurlCloudBaseUrl = process.env.UNFURL_CLOUD_BASE_URL || "https://unfurl.cloud"

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
    },    
  },

  pages: {
    index: "src/main.ts",

    demo: {
      entry: "src/pages/project_overview/index.js",
      template: 'public/demo.html',
      unfurlCloudBaseUrl
    },

    dashboard: {
      title: "Unfurl Cloud Dashboard",
      entry: "src/pages/dashboard/index.js",
      unfurlCloudBaseUrl
    }
  }
};


