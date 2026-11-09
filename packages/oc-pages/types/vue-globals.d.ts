// What every oc-pages component gets without importing it.

// Installed by a global mixin in standalone (src/assets/javascripts/locale.js)
// and by GitLab's Translate plugin in the fork; templates call them unqualified.
// project_overview/index.js: its own fields plus the mount element's dataset,
// so everything from there is a string or absent
interface ProjectGlobal {
  projectPath: string
  buttonStar: {text?: string, link?: string, icon?: string, count?: string, endpoint?: string}
  buttonFork: {path?: string, link?: string, count?: string}
  projectName?: string
  readme?: string
  readmeRaw?: string
  deploymentCount?: string
  linkDeployment?: string
  treePath?: string
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $projectGlobal: ProjectGlobal
    __: (text: string) => string
    n__: (singular: string, plural: string, count: number) => string
    s__: (keyOrContext: string, key?: string) => string
    // GlToast; only the dashboard app installs it
    $toast?: {show(message: string, options?: {onComplete?(): void}): unknown}
  }
}

export {}
