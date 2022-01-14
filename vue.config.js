const path = require('path');
const fs = require('fs')

// this alias is used by code copied from gitlab
const alias = {
  'oc': path.join(__dirname, 'src/assets/javascripts'),
  '~': path.join(__dirname, 'src/assets/javascripts'),
  'oc_pages': path.join(__dirname, 'src/gitlab-oc')
  //'oc': path.join(__dirname, 'src/gitlab-oc')
}

const httpProxyMiddleware = require('http-proxy-middleware');
const unfurlCloudBaseUrl = process.env.UNFURL_CLOUD_BASE_URL || "https://unfurl.cloud"

const JSON_EXT = '.json'
const projectDataDir = path.join(__dirname, 'apollo-server/data')
const projectPages = {}
const projectPageBase = {
  entry: "src/pages/project_overview/index.js",
  template: 'public/demo.html',
  unfurlCloudBaseUrl
}

for(const tld of fs.readdirSync(projectDataDir)) {
  for(const f of fs.readdirSync(path.join(projectDataDir, tld))) {
    if(path.extname(f) != JSON_EXT) continue
    const projectPath = `${tld}/${path.basename(f, JSON_EXT)}`
    projectPages[projectPath] = {...projectPageBase, projectPath}
  }
}


module.exports = {
  devServer: {
    before(app) {
      const proxy = httpProxyMiddleware('/graphql', {
        target: 'http://localhost:4000/graphql',
        changeOrigin: true,
        ws: true,
        ignorePath: true,
      })
      app.use(proxy)
    }
    
  },
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
      symlinks: false
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
    ...projectPages,

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


