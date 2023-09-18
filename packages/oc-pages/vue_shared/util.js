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
const Azure = 'ConnectsTo.AzureEnvironment'
const K8s = 'unfurl.relationships.ConnectsTo.K8sCluster'
const DigitalOcean = 'ConnectsTo.DigitalOceanEnvironment'
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
  DigitalOceanEnvironment: DigitalOcean,
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

export function lookupCloudProviderShortName(key) {
  const actual = lookupCloudProviderAlias(key)
  const dict = {
    [GCP]: 'GCP',
    [AWS]: 'AWS',
    [K8s]: 'K8s',
    [Azure]: 'Azure',
    [DigitalOcean]: 'DO'
  }
  return dict[actual]
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
