/*
 * The four widgets on this page reach the fork's GitLab directly -- REST under
 * /api/v4, the GitHub import routes, and the fork-only project-dns service.
 * Everything they call goes through `~/lib/utils/axios_utils`, which is a bare
 * re-export of the axios default instance, so replacing its adapter here
 * intercepts the lot.
 *
 * This is deliberately not cy.intercept: LocalImageRepoSource and
 * UnfurlCloudMirroredRepoImageSource fetch from `data()` and from an immediate
 * watcher, which run while the entry module is still evaluating. An adapter
 * installed before the components are imported is in place by then; that
 * timing is what defeated the earlier attempt to fixture these from the spec.
 */
import axios from '~/lib/utils/axios_utils'

const REGISTRY = 'registry.gallery.test'

const PROJECTS = [
  {
    id: 101,
    path_with_namespace: 'onecommons/blueprints/gallery',
    name: 'gallery',
    visibility: 'private',
    default_branch: 'main',
  },
  {
    id: 102,
    path_with_namespace: 'onecommons/blueprints/sample-app',
    name: 'sample-app',
    visibility: 'public',
    default_branch: 'main',
  },
  {
    id: 103,
    path_with_namespace: 'onecommons/blueprints/media-service',
    name: 'media-service',
    visibility: 'private',
    default_branch: 'trunk',
  },
  // the imported GitHub repo, so its branches resolve like any other project
  {
    id: 201,
    path_with_namespace: 'onecommons/hello-world',
    name: 'hello-world',
    visibility: 'private',
    default_branch: 'main',
  },
]

/*
 * registry_url is derived by chopping the project path off the end of this
 * prefix, so a prefix that does not end with the path yields nonsense rather
 * than a missing value -- which is a much harder fixture bug to spot.
 */
function projectInfo(project) {
  return {
    ...project,
    web_url: `https://gallery.test/${project.path_with_namespace}`,
    container_registry_image_prefix: `${REGISTRY}/${project.path_with_namespace}`,
  }
}

const BRANCHES = [
  {name: 'main', default: true},
  {name: 'staging', default: false},
  {name: 'feature/combobox', default: false},
]

const REGISTRY_REPOSITORIES = [
  {id: 1, path: 'onecommons/blueprints/gallery/app', location: `${REGISTRY}/onecommons/blueprints/gallery/app`},
  {id: 2, path: 'onecommons/blueprints/gallery/worker', location: `${REGISTRY}/onecommons/blueprints/gallery/worker`},
]

const GITHUB_STATUS = {
  provider_repos: [
    {
      id: 1,
      full_name: 'octocat/hello-world',
      sanitized_name: 'hello-world',
      provider_link: 'https://github.com/octocat/hello-world',
    },
    {
      id: 2,
      full_name: 'octocat/spoon-knife',
      sanitized_name: 'spoon-knife',
      provider_link: 'https://github.com/octocat/spoon-knife',
    },
  ],
  // merged over the provider repo by GithubImportHandler.mapRepos, which is
  // what moves hello-world to IMPORTED and gives it a project id to fetch
  // branches with
  imported_projects: [
    {
      id: 201,
      sanitized_name: 'hello-world',
      import_status: 'finished',
      provider_link: 'https://github.com/octocat/hello-world',
      path_with_namespace: 'onecommons/hello-world',
    },
  ],
}

function findProject(idOrPath) {
  const decoded = decodeURIComponent(idOrPath)
  return PROJECTS.find(p => String(p.id) === String(idOrPath) || p.path_with_namespace === decoded)
}

/*
 * Ordered because /api/v4/projects/:id has to lose to the routes nested under
 * it. Each entry returns the response body, or undefined to fall through to
 * the unmatched-route warning.
 */
const ROUTES = [
  [/^\/api\/v4\/dashboards\b/, () => []],
  [/^\/api\/v4\/projects\/([^/]+)\/repository\/branches\b/, () => BRANCHES],
  [/^\/api\/v4\/projects\/([^/]+)\/repository\/commits\b/, () => [{id: 'c0ffee1234567890'}]],
  [/^\/api\/v4\/projects\/([^/]+)\/registry\/repositories\b/, () => REGISTRY_REPOSITORIES],
  [/^\/api\/v4\/projects\/?$/, () => PROJECTS],
  [/^\/api\/v4\/projects\/([^/]+)$/, ([id]) => {
    const project = findProject(id)
    return project && projectInfo(project)
  }],
  [/^\/import\/github\/status\.json$/, () => GITHUB_STATUS],
  /*
   * checkCName recurses on a 5s sleep until every nameserver reports true and
   * the target is reachable, so the answer decides which state the widget
   * settles in. app.partial.test never gets there on purpose: it is the only
   * way to photograph the resolved-nameserver badges and the button's loading
   * state, which the completed run clears.
   */
  [/^\/services\/project-dns\/cname_verification\/app\.partial\.test\b/, () => ({
    nameserver_results: {'ns1.gallery.test': true, 'ns2.gallery.test': false},
    target_reachable: false,
  })],
  [/^\/services\/project-dns\/cname_verification\//, () => ({
    nameserver_results: {'ns1.gallery.test': true, 'ns2.gallery.test': true},
    target_reachable: true,
  })],
]

function resolve(url) {
  const path = url.split('?')[0]
  for (const [pattern, handler] of ROUTES) {
    const match = path.match(pattern)
    if (match) return handler(match.slice(1))
  }
  return undefined
}

export function installApiStub() {
  axios.defaults.adapter = config => new Promise((resolvePromise, reject) => {
    const data = resolve(config.url)

    if (data === undefined) {
      // loud rather than pending: an unstubbed route otherwise shows up as a
      // component stuck in a loading state with nothing to explain it. Also
      // recorded on window so the spec can fail on it rather than relying on
      // someone reading the console output.
      window.__forkInputsMisses = window.__forkInputsMisses || []
      window.__forkInputsMisses.push(`${config.method?.toUpperCase()} ${config.url}`)
      console.warn(`[fork-inputs] no stub for ${config.method?.toUpperCase()} ${config.url}`)
      const error = new Error(`no stub for ${config.url}`)
      error.request = {status: 404}
      error.config = config
      reject(error)
      return
    }

    resolvePromise({data, status: 200, statusText: 'OK', headers: {}, config, request: {status: 200}})
  })
}

export {PROJECTS, BRANCHES, REGISTRY_REPOSITORIES, GITHUB_STATUS}
