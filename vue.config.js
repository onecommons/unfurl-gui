const path = require('path');
const fs = require('fs')

// this alias is used by code copied from gitlab
const alias = {
  'oc': path.join(__dirname, 'src/assets/javascripts'),
  'oc_dashboard': path.join(__dirname, 'src/gitlab-oc/dashboard'),
  '~': path.join(__dirname, 'src/assets/javascripts'),
  'oc_pages': path.join(__dirname, 'src/gitlab-oc')
  //'oc': path.join(__dirname, 'src/gitlab-oc')
}

const httpProxyMiddleware = require('http-proxy-middleware');
const unfurlCloudBaseUrl = process.env.UNFURL_CLOUD_BASE_URL || ""
const username = process.env.UNFURL_CLOUD_USERNAME || "demo"
const fullname = process.env.UNFURL_CLOUD_FULLNAME || "Unfurl Cloud Craftsman"
// TODO fix this
const projectPath = `${username}/dashboard`

const projectPages = {}
const unfurlGUIBase = {unfurlCloudBaseUrl, username, fullname, projectPath}
const projectPageBase = {
  entry: "src/pages/project_overview/index.js",
  template: 'public/demo.html',
  ...unfurlGUIBase
}

try {
  const liveDb = JSON.parse(fs.readFileSync('live/db.json', 'utf-8'))
  for(const projectPath in liveDb.projects) {
    projectPages[projectPath] = {...projectPageBase, projectPath}
  }
} catch(e) {
  console.error('could not read live/db.json for html templates')
}

module.exports = {
  devServer: {
    disableHostCheck: true,
    before(app) {
      const proxy = httpProxyMiddleware('/graphql', {
        target: 'http://localhost:4000/graphql',
        changeOrigin: true,
        ws: true,
        ignorePath: true,
        protocolRewrite: process.env.SSL_PROXY,
      })

      const postProxy = httpProxyMiddleware(
        function(_, req) {
          return req.method == 'POST'
        },
        {
          target: 'http://localhost:4000',
          changeOrigin: true,
          protocolRewrite: process.env.SSL_PROXY
        }
      )
      app.use(proxy)
      app.use(postProxy)
    }
    
  },
  pluginOptions: {
    apollo: {
      enableMocks: false,
      enableEngine: true,
      lintGQL: true
    }
  },
  configureWebpack: {
    resolve: {
      alias,
      symlinks: false
    },    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: [
            'eslint-loader',
            'webpack-preprocessor-loader',
          ]
        },
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true
              }
            }
          ]
        }
      ],
  }
  },

  pages: {
    index: {
      entry: "src/main.ts",
      template: 'public/index.html',
      ...unfurlGUIBase
    },

    demo: {
      ...projectPageBase,
      entry: "src/pages/project_overview/index.js",
      template: 'public/demo.html',
      unfurlCloudBaseUrl
    },
    ...projectPages,

    dashboard: {
      title: "Unfurl Cloud Dashboard",
      entry: "src/pages/dashboard/index.js",
      unfurlCloudBaseUrl,
      ...unfurlGUIBase
    },

    form: {
      title: "Formily Testbed",
      entry: "src/pages/form/main.ts",
      template: 'public/form.html',
      unfurlCloudBaseUrl
    }
  }
};


