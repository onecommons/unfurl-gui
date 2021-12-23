const path = require('path');

// this alias is used by code copied from gitlab
const alias = {
  '~': path.join(__dirname, 'src/assets/javascripts'),
  'oc': path.join(__dirname, 'src/gitlab-oc')
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
    index: {
      entry: "src/main.ts",
      template: 'public/index.html',
      unfurlCloudBaseUrl
    },

    demo: {
      entry: "src/pages/project_overview/index.js",
      template: 'public/demo.html',
      unfurlCloudBaseUrl
    },

    dashboard: {
      title: "Unfurl Cloud Dashboard",
      entry: "src/pages/dashboard/index.js",
      unfurlCloudBaseUrl
    },

    form: {
      title: "Formily Testbed",
      entry: "src/pages/form/main.ts",
      template: 'public/form.html',
      unfurlCloudBaseUrl
    }
  }
};


