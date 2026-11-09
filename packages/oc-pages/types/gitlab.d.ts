// Fork-only modules oc-pages imports inside `#!if !standalone` blocks.
// Standalone strips those imports, so only these declarations exist there;
// they state what oc-pages uses, which the fork's modules must keep providing.

declare module 'oc/pages/projects/edit/uf_badge' {
    export default function initUnfurlBadgeUrlBuilder(): void
}

declare module '~/ci/job_details' {
    export const initJobDetails: () => unknown
}

// @gitlab/ui ships no declarations; components use it untyped. Declared here
// because this file is a script: in a module, this would be an augmentation.
declare module '@gitlab/ui'
