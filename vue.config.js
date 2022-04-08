const { iterateProjects } = require('./apollo-server/utils/iterate_projects')
const path = require('path');
const fs = require('fs')
const os = require('os')


// this alias is used by code copied from gitlab
const alias = {
  'oc': path.join(__dirname, 'src/assets/javascripts'),
  'oc_dashboard': path.join(__dirname, 'src/gitlab-oc/dashboard'),
  'oc_vue_shared': path.join(__dirname, 'src/gitlab-oc/vue_shared'),
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

for(const {projectPath, blueprint} of iterateProjects()) {
  projectPages[projectPath] = {...projectPageBase, projectPath}
}

module.exports = {
  devServer: {
    onListening(devServer) {
      const tmpDir = path.join(os.tmpdir(), '.unfurl-gui')
      function setPid(program, pid) {
        return fs.writeFileSync(path.join(tmpDir, `${program}.pid`), pid.toString())
      }
      setPid('serve', process.pid)
    },
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
        function (_, req) {
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
      app.get(`/:user/dashboard/-/pipelines/:deployment`, (req, res) => {
        res.redirect(`/dashboard/deployments/${req.params.deployment}`)
      })
    },
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


