export function slugify(text) {
    return text && text
        .toString() 
        .toLowerCase()
        .normalize('NFD')
        .trim()
        .replace(/(\-\-+|_|\s+)/g, '-')
        .replace(/[^\w\-]+/g, '')
}

export const USER_HOME_PROJECT = 'dashboard';

// TODO make this a const
export function userDefaultPath() {
    return 'unfurl.json'
}

export function generateCardId(name) {
    return btoa(name).replace(/=/g, '')
}

const GCP = 'unfurl.relationships.ConnectsTo.GoogleCloudProject'
const AWS = 'unfurl.relationships.ConnectsTo.AWSAccount'
const Azure = 'unfurl.relationships.ConnectsTo.AzureAccount'
const K8s = 'unfurl.relationships.ConnectsTo.K8sCluster'
const CLOUD_PROVIDER_ALIASES = {
    AWSAccount: AWS,
    aws: AWS,
    [AWS]: AWS,
    AWS,
    GoogleCloudAccount: GCP,
    GoogleCloudProject: GCP,
    gcp: GCP,
    [GCP]: GCP,
    GCP,
    AzureAccount: Azure,
    [Azure]: Azure,
    Azure,
    azure: Azure,
    K8s,
    [K8s]: K8s,
    k8s: K8s,
    kubernetes: K8s,
    'Google Cloud Platform': GCP,
    'Amazon Web Services': AWS,
    'Kubernetes': K8s,
    'Azure': Azure
}

export function lookupCloudProviderAlias(key) {
    const result = CLOUD_PROVIDER_ALIASES[key]
    return result
}
