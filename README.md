**Node LTS is recommended**

## Project setup & commands
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn start
```
This will run both the vue dev server and apollo by default.
To run only apollo or vue run with `yarn start <serve|apollo>`.

### View the log of apollo or vue dev server
```
yarn tail <serve|apollo>
```
Run with `yarn tail <serve|apollo> &` to run as a background job.

### To shut down the development environment
```
yarn stop
```


# Notes

`src/gitlab-oc` is a symlink to `packages/oc-pages`.   The oc-pages package is also used in the gitlab-oc repo, so take care when making changes and make sure the code stays portable between gitlab-oc and unfurl-gui.  When importing modules from inside oc-pages/ to other locations inside the src/ directory, use the appropriate aliases to prevent resolver errors on gitlab-oc.  Check `vue.config.js` to see what the current aliases resolve to.

See Apollo boilerplate added with `vue add apollo`... see https://apollo.vuejs.org/

Need to run `yarn run apollo:start` first to start the apollo graphql server (runs on port 4000).

see https://gitlab-org.gitlab.io/gitlab-ui/ and https://gitlab-org.gitlab.io/gitlab-svgs/

gitlab-ui wraps https://bootstrap-vue.org/ which wraps bootstrap 4

It also depends on https://portal-vue.linusb.org/ which we could use to build a vs-code like minimap of a view using http://asvd.github.io/syncscroll/ or similar.
# Gotchas!

* When the app is started it any blueprint projects found in "apollo-server/repos" will be made available to the app -- but you will have to type in the URL manually, e.g. http://localhost:8080/testing/simple-blueprint/.

* If, during startup, the application blueprint's ensemble-template.yaml is newer than its unfurl.json it will automatically be re-exported and replaced.

* The dashboard project that unfurl-gui uses as your dashboard (and when you deploy etc.) is in "live/repos/demo/dashboard/". Unless $NO_FIXTURES is set, starting yarn apollo:start will overwrite the contents of that directory with the contents of apollo-server/repos/$UNFURL_CLOUD_USERNAME/dashboard/ including its "environment.json" -- so you will lose any deployments you already created. (Where $UNFURL_CLOUD_USERNAME defaults to “demo”, which is symlinked to “user1")

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

The `UNFURL_CLOUD_USERNAME` environment variable is used in `yarn run apollo:start` and `yarn run serve` to determine the user's profile for looking up environments and determining the user's ability to edit a project.  At the moment it makes testing rather annoying.

### On writing cypress tests
For consistant results
* Always wait around 100 ms between inputs (this may be due to debouncing)
* In addition to using our custom `waitForGraphql` command I'd also suggest using cy.get() on an element that indicates the page is finished loading.  `waitForGraphql` is not very reliable at the moment.

# Readme generated by original vui cli boilerplate follows:

https://github.com/lifeomic/json-schema-to-graphql-types


### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

