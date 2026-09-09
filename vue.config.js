const path = require('path');
const webpack = require('webpack')
const _ = require('lodash')
const {PAGES: FIXTURE_PAGES, isFixtureOnly, DIR: FIXTURE_DIR} = require('./scripts/src/fixture-pages.js')

// vue-cli's production defaults, with fixture-only chunks moved under fixtures/
const chunkPath = ext => pathData =>
  `${ext}/${isFixtureOnly(pathData.chunk) ? FIXTURE_DIR + '/' : ''}[name].[contenthash:8].${ext}`
const {createProxyMiddleware} = require('http-proxy-middleware')


const COMPAT = path.join(__dirname, 'src/assets/javascripts/vue3compat')

// this alias is used by code copied from gitlab
const alias = {
  'oc': path.join(__dirname, 'src/assets/javascripts'),
  'oc_dashboard': path.join(__dirname, 'src/gitlab-oc/dashboard'),
  'oc_vue_shared': path.join(__dirname, 'src/gitlab-oc/vue_shared'),
  '~': path.join(__dirname, 'src/assets/javascripts'),
  'oc_pages': path.join(__dirname, 'src/gitlab-oc'),
  //'oc': path.join(__dirname, 'src/gitlab-oc')

  /*
   * Vue 3 through @vue/compat. These mirror the fork's CONTEXT_ALIASES
   * (config/helpers/context_aliases_shared.js) so oc-pages resolves the same
   * modules in both builds.
   *
   * Each key is exact-match: vue-cli already sets 'vue$' for a Vue 3 project,
   * and an unsuffixed key would sit beside it instead of replacing it.
   *
   * @vue/compat's exports map points 'import' at the full build; naming the
   * runtime one keeps the template compiler out of the bundle.
   */
  'vue$': path.join(COMPAT, 'vue.js'),
  '@vue/compat$': path.join(__dirname, 'node_modules/@vue/compat/dist/vue.runtime.esm-bundler.js'),
  'vuex$': path.join(COMPAT, 'vuex.js'),
  'vuex/dist/logger$': path.join(COMPAT, 'vuex_logger.js'),
  'vue-router$': path.join(COMPAT, 'vue_router.js'),
  'portal-vue$': path.join(COMPAT, 'portal_vue_vue3.js'),
  'vue-demi$': 'vue-demi/lib/v3/index.mjs',

  // @gitlab/ui's dist is compiled for Vue 2; only its src compiles either way
  '@gitlab/ui$': '@gitlab/ui/src',
  '@gitlab/ui/dist/charts$': '@gitlab/ui/src/charts'
}

// function shouldProxy(req) {
//   const {accept} = req.headers
//
//   if(req.path.startsWith('/js/')) return false
//
//   return true
// }

module.exports = {
  // @gitlab/ui is consumed from src (see the alias), so its .js has to go
  // through babel the way ours does -- the published src is not pre-compiled.
  transpileDependencies: ['@gitlab/ui'],

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
     * Measured on Vue 3 -- largest asset chunk-vendors.js at 1192 KiB,
     * largest entrypoint project.html at 1684 KiB. Source maps are exempt by
     * webpack's default assetFilter. The entrypoint fell 84 KiB on the switch:
     * @gitlab/ui compiled from src tree-shakes better than its dist bundle,
     * which more than paid for the compat runtime.
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

  /*
   * The template compiler is the fork's, not stock @vue/compiler-dom. It
   * rewrites the AST around vuejs/core issues the fork already hit: hoisting
   * 'key' off the children of a '<template v-for>', dropping comment nodes so
   * slot-emptiness agrees with Vue 2, dropping 'v-once' under 'v-if'.
   * Compiling oc-pages with anything else would give it different render
   * functions here than in the fork.
   */
  chainWebpack(config) {
    config.module
      .rule('vue')
      .use('vue-loader')
      .tap(options => ({
        ...options,
        compiler: require.resolve('./scripts/src/vue3_template_compiler.js'),
        compilerOptions: {
          ...options.compilerOptions,
          compatConfig: {
            MODE: 2,

            COMPILER_V_BIND_OBJECT_ORDER: 'suppress-warning',
            COMPILER_V_BIND_SYNC: 'suppress-warning',
            COMPILER_V_IF_V_FOR_PRECEDENCE: 'suppress-warning',
            COMPILER_V_ON_NATIVE: 'suppress-warning'
          }
        }
      }))
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


