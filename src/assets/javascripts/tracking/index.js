// Stub. GitLab's Tracking reports to Snowplow, which standalone has no endpoint
// for and no reason to call; the fork build resolves `~` to the real module.
//
// mixin() must supply a `track` method: components call `this.track(...)` from
// watchers and handlers, so a mixin returning nothing throws there rather than
// no-opping. Kept as methods for the same reason the real one does.
const noop = () => {};

export default {
  mixin: () => ({ methods: { track: noop, trackEvent: noop } }),
  event: noop,
  enableFormTracking: noop,
};
