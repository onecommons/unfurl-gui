import LocalImageRepoSource from './LocalImageRepoSource.vue'
import GithubMirroredRepoImageSource from './GithubMirroredRepoImageSource.vue'
import EnvironmentTooltip from './tooltips/EnvironmentTooltip.vue'

const customComponents = {
    GithubMirroredRepoImageSource,
    LocalImageRepoSource,
}

const customTooltips = {
    'environment': EnvironmentTooltip,
}

export function getCustomInputComponent(type) {
    return customComponents[type] ?? null
}

export function getCustomTooltip(type) {
    return customTooltips[type] ?? null
}
