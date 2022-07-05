import LocalImageRepoSource from './LocalImageRepoSource.vue'

const customComponents = {
    LocalImageRepoSource,
}

export function getCustomInputComponent(type) {
    return customComponents[type] ?? null
}
