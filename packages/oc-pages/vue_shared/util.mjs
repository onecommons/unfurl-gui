export { default as slugify } from './slugify'

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
const DigitalOcean = 'unfurl.relationships.ConnectsTo.DigitalOcean'
const CLOUD_PROVIDER_ALIASES = {
  AWSAccount: AWS,
  aws: AWS,
  [AWS]: AWS,
  AWS,
  GoogleCloudAccount: GCP,
  GoogleCloudProject: GCP,
  gcp: GCP,
  [GCP]: GCP,
  'Google Cloud': GCP,
  GCP,
  AzureAccount: Azure,
  [Azure]: Azure,
  Azure,
  azure: Azure,
  K8s,
  [K8s]: K8s,
  k8s: K8s,
  kubernetes: K8s,
  DigitalOcean,
  [DigitalOcean]: DigitalOcean,
  'Google Cloud Platform': GCP,
  'Amazon Web Services': AWS,
  'Kubernetes': K8s,
  'Azure': Azure,
  'Digital Ocean': DigitalOcean,
}

export function lookupCloudProviderAlias(key) {
  const result = CLOUD_PROVIDER_ALIASES[key]
  return result
}


export function cloudProviderFriendlyName(key) {
    const actual = lookupCloudProviderAlias(key)
    const dict = {
        [GCP]: 'Google Cloud Platform',
        [AWS]: 'Amazon Web Services',
        [K8s]: 'Kubernetes',
        [Azure]: 'Azure',
        [DigitalOcean]: 'Digital Ocean'
    }
    return dict[actual]
}
