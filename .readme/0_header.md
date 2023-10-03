[//]: # (README.md is generated, do not edit directly)

**Node LTS is recommended**

# Notes

`src/gitlab-oc` is a symlink to `packages/oc-pages`.   The oc-pages package is also used in the gitlab-oc repo, so take care when making changes and make sure the code stays portable between gitlab-oc and unfurl-gui.  When importing modules from inside oc-pages/ to other locations inside the src/ directory, use the appropriate aliases to prevent resolver errors on gitlab-oc.  Check `vue.config.js` to see what the current aliases resolve to.

See Apollo boilerplate added with `vue add apollo`... see https://apollo.vuejs.org/

Need to run `yarn run apollo:start` first to start the apollo graphql server (runs on port 4000).

see https://gitlab-org.gitlab.io/gitlab-ui/ and https://gitlab-org.gitlab.io/gitlab-svgs/

gitlab-ui wraps https://bootstrap-vue.org/ which wraps bootstrap 4

It also depends on https://portal-vue.linusb.org/ which we could use to build a vs-code like minimap of a view using http://asvd.github.io/syncscroll/ or similar.
