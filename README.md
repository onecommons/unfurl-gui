# Notes

`src/gitlab-oc` is a symlink to `packages/oc-pages`.   The oc-pages package is also used in the gitlab-oc repo, so take care when making changes and make sure the code stays portable between gitlab-oc and unfurl-gui.  When importing modules from inside oc-pages/ to other locations inside the src/ directory, use the appropriate aliases to prevent resolver errors on gitlab-oc.  Check `vue.config.js` to see what the current aliases resolve to.

See Apollo boilerplate added with `vue add apollo`... see https://apollo.vuejs.org/

Need to run `yarn run apollo:start` first to start the apollo graphql server (runs on port 4000).

see https://gitlab-org.gitlab.io/gitlab-ui/ and https://gitlab-org.gitlab.io/gitlab-svgs/

gitlab-ui wraps https://bootstrap-vue.org/ which wraps bootstrap 4

It also depends on https://portal-vue.linusb.org/ which we could use to build a vs-code like minimap of a view using http://asvd.github.io/syncscroll/ or similar.

# Gotchas!

* If the `apollo-server/unfurl.json` changed you will delete `live/db.json` so it is recreated with the new unfurl.json.

* If you change the graphql schema (`apollo-server/*.graphql`) you will need to regenerate the graphql and json files in `./graphql` with this command:

```
yarn apollo:schema:generate    
```

And then commit those changes. (The `graphql/template-strings` eslinter plugin requires those files.)



## Cypress tests
Here is an example invocation for running Cypress tests interactively through gitlab_oc.  Most parameters are not required testing unfurl-gui on it's own.
```
yarn run cypress open -e OC_URL="http://0.0.0.0:3000",OC_NAMESPACE="root",OC_USERNAME="root",OC_PASSWORD="c6uRYQKrLuxNCd8"
```

Note that for certain tests you may need to create projects mapping to existing fixtures such as `apostrophe-demo` and `apostrophe-demo-v2`


# Readme generated by original vui cli boilerplate follows:

https://github.com/lifeomic/json-schema-to-graphql-types


## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn serve
```

### Compiles and minifies for production
```
yarn build
```

### Lints and fixes files
```
yarn lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
