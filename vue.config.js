const path = require('path');
const _ = require('lodash')
const {createProxyMiddleware} = require('http-proxy-middleware')


// this alias is used by code copied from gitlab
const alias = {
  'oc': path.join(__dirname, 'src/assets/javascripts'),
  'oc_dashboard': path.join(__dirname, 'src/gitlab-oc/dashboard'),
  'oc_vue_shared': path.join(__dirname, 'src/gitlab-oc/vue_shared'),
  '~': path.join(__dirname, 'src/assets/javascripts'),
  'oc_pages': path.join(__dirname, 'src/gitlab-oc')
  //'oc': path.join(__dirname, 'src/gitlab-oc')
}

// function shouldProxy(req) {
//   const {accept} = req.headers
//
//   if(req.path.startsWith('/js/')) return false
//
//   return true
// }

module.exports = {
  // Component <style scoped> blocks land in chunk-common in a different order
  // per entry point, which mini-css-extract-plugin reports as a conflict. The
  // order between scoped styles is meaningless by construction -- each is
  // namespaced to its own component -- so the ordering it can't satisfy is one
  // that never mattered.
  css: {
    extract: { ignoreOrder: true }
  },
  devServer: {
    allowedHosts: 'all',
    // gdk's nginx serves the unfurl server under this path, with the prefix stripped
    proxy: {
      '/services/unfurl-server': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        pathRewrite: {'^/services/unfurl-server': ''},
      },
    },
    setupMiddlewares(middlewares, {app}) {
    //   const unfurlProxy = createProxyMiddleware({
    //     target: 'http://localhost:4000/graphql',
    //     changeOrigin: true,
    //     ws: true,
    //     ignorePath: true,
    //     protocolRewrite: process.env.SSL_PROXY,
    //   })
    //
      app.use((req, res, next) => {
        // console.log(req.path)
        // if(shouldProxy(req)) {
        //   return unfurlProxy(req, res, next)
        // }
        next()
      })

      return middlewares
    }
  },
  configureWebpack: {
    // A budget rather than webpack's 244 KiB default, which nothing here has
    // ever met. Set just above today's largest (chunk-vendors 1.78 MiB, the
    // project entry 2.21 MiB) so growth has to be a deliberate decision --
    // phase 2 swaps @gitlab/ui 60 -> 137 and adds Tailwind, which will move
    // these.
    performance: {
      maxAssetSize: 2 * 1024 * 1024,
      maxEntrypointSize: 2.6 * 1024 * 1024
    },
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
            'babel-loader',
            {
              loader: 'webpack-preprocessor-loader',
              options: {
                params: {
                  standalone: true,
                },
              },
            },
          ]
        },
      ],
    }
  },

  pages: {
    project: {
      entry: "src/pages/project_overview/index.js"
    },

    dashboard: {
      entry: "src/pages/dashboard/index.js"
    },

    // templated by public/public_cloud.html
    public_cloud: {
      entry: "src/pages/public_cloud/index.js"
    },

    // Mounts oc_inputs.vue against a synthetic schema with a stub store, so the
    // formily layer can be exercised without a server. Built for spike 2.0 and
    // kept: 2A.3 rewrites every widget it renders.
    'form-fixture': {
      entry: "src/pages/form-fixture/index.js",
      template: "public/form-fixture.html",
      filename: "form-fixture.html"
    }
  }
};


