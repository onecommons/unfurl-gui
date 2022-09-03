import LocalImageRepoSource from './LocalImageRepoSource.vue'
import GithubMirroredRepoImageSource from './GithubMirroredRepoImageSource.vue'
import UnfurlCloudMirroredRepoImageSource from './UnfurlCloudMirroredRepoImageSource.vue'
import EnvironmentTooltip from './tooltips/EnvironmentTooltip.vue'

const customComponents = {
    GithubMirroredRepoImageSource,
    LocalImageRepoSource,
    UnfurlCloudMirroredRepoImageSource
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
