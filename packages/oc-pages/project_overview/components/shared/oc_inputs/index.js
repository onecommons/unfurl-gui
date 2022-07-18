import LocalImageRepoSource from './LocalImageRepoSource.vue'
import GithubMirroredRepoImageSource from './GithubMirroredRepoImageSource.vue'

const customComponents = {
    GithubMirroredRepoImageSource,
    LocalImageRepoSource,
}

export function getCustomInputComponent(type) {
    return customComponents[type] ?? null
}
