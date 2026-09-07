export const token = ""

// GitLab's real module default-exports the whole thing, and oc-pages imports
// it that way (`import csrf from '~/lib/utils/csrf'` then `csrf.token`).
// Without a default export that is `undefined.token` at runtime here, not just
// a build warning.
export default { token }
