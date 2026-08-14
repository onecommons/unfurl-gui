const DEFAULT_CLOUDMAP_URL = '/services/unfurl-server/types?auth_project=onecommons%2Fstd&cloudmap=onecommons/cloudmap&file=dummy-ensemble.yaml'

export default function getData() {
    if(!getData.promise) {
        // read lazily: gitlab injects data-cloudmap server-side, standalone falls back
        const container = document.querySelector('div#chart')
        const cloudmapUrl = container?.dataset?.cloudmap || DEFAULT_CLOUDMAP_URL

        getData.promise = fetch(cloudmapUrl)
            .then(res => res.json())
    }

    return getData.promise
}
