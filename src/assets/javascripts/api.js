// Stub. GitLab's Api client is fork-only: the ci_variables store is the sole
// consumer in oc-pages, and that store is never registered standalone (the
// Variables tab is `v-if="!standalone"`, and the store module is only built
// when `!gon.unfurl_gui`) -- it does not appear in the standalone bundle at
// all. This exists so `~/api` resolves for the bundler and for jest; the fork
// build resolves `~` to the real client.
export default {
  environments: () => Promise.resolve({ data: [] }),
};
