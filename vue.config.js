const path = require('path');
const webpack = require('webpack')
const _ = require('lodash')
const {PAGES: FIXTURE_PAGES, isFixtureOnly, DIR: FIXTURE_DIR} = require('./scripts/src/fixture-pages.js')

// vue-cli's production defaults, with fixture-only chunks moved under fixtures/
const chunkPath = ext => pathData =>
  `${ext}/${isFixtureOnly(pathData.chunk) ? FIXTURE_DIR + '/' : ''}[name].[contenthash:8].${ext}`
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
    extract: {
      ignoreOrder: true,
      filename: chunkPath('css'),
      chunkFilename: chunkPath('css')
    }
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
    output: {
      filename: chunkPath('js'),
      chunkFilename: chunkPath('js')
    },
    plugins: [
      // pikaday, under gl-datepicker, requires moment as an optional dependency
      // inside a try/catch. Webpack resolves that statically, and moment's own
      // dynamic require of ./locale/<name> then drags in all 135 locales --
      // 203 KiB of the 262 moment costs. The core stays, so moment still works.
      new webpack.IgnorePlugin({resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/})
    ],

    /*
     * CI fails the build on any webpack warning, so these are a gate rather
     * than advice. Roughly 10% over what the build actually produces, which is
     * enough room for ordinary work and tight enough to catch a dependency
     * arriving: the two that have bitten so far were moment's locales at
     * 203 KiB and element-ui at 792 KiB, and either would trip this.
     *
     * Measured after element-ui was removed -- largest asset chunk-vendors.js
     * at 1167 KiB, largest entrypoint project.html at 1768 KiB. Source maps
     * are exempt by webpack's default assetFilter. Re-measure and re-tighten
     * after 2B; the Vue 3 switch moves both numbers.
     */
    performance: {
      maxAssetSize: 1.25 * 1024 * 1024,
      maxEntrypointSize: 1.9 * 1024 * 1024
    },
    resolve: {
      alias,
      symlinks: false,
      fallback: {
        // file-selector pulls in mime-types, which wants node's path. The fork
        // build supplies a polyfill; standalone did not, which is part of why
        // the component was unreachable here at all. Only the gallery chunk
        // imports it, so nothing else grows.
        path: require.resolve('path-browserify')
      }
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

    // Test fixtures -- see scripts/src/fixture-pages.js for why they exist and
    // how they are kept out of the release tarball.
    ..._.mapValues(FIXTURE_PAGES, ({entry}, name) => ({
      entry,
      template: `public/${name}.html`,
      filename: `${FIXTURE_DIR}/${name}.html`
    }))
  }

};


