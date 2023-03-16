import LocalImageRepoSource from './LocalImageRepoSource.vue'
import GithubMirroredRepoImageSource from './GithubMirroredRepoImageSource.vue'
import UnfurlCloudMirroredRepoImageSource from './UnfurlCloudMirroredRepoImageSource.vue'
import UnfurlCNamedDNSZone from './UnfurlCNamedDNSZone.vue'

import EnvironmentTooltip from './tooltips/EnvironmentTooltip.vue'

import GenerateDirective from './directives/GenerateDirective.vue'

const customComponents = {
    GithubMirroredRepoImageSource,
    LocalImageRepoSource,
    UnfurlCloudMirroredRepoImageSource,
    UnfurlCNamedDNSZone
}

const customTooltips = {
    'environment': EnvironmentTooltip,
}

const uiDirectives = {
    'generate': GenerateDirective,
}

export function getCustomInputComponent(type) {
    return customComponents[type] ?? null
}

export function getCustomTooltip(type) {
    return customTooltips[type] ?? null
}

export function getUiDirective(type) {
    return uiDirectives[type] ?? null
}

export {default as FakePassword} from './formily-fake-password'
