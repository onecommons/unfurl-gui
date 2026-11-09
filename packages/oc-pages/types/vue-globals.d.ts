// What every oc-pages component gets without importing it.

// Installed by a global mixin in standalone (src/assets/javascripts/locale.js)
// and by GitLab's Translate plugin in the fork; templates call them unqualified.
declare module 'vue' {
  interface ComponentCustomProperties {
    __: (text: string) => string
    n__: (singular: string, plural: string, count: number) => string
    s__: (keyOrContext: string, key?: string) => string
  }
}

export {}
