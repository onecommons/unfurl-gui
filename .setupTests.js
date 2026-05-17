// babel+jest is completely asinine
import 'regenerator-runtime/runtime'
// storage-keys.js reads window.gon.unfurl_server_url at module load to compute
// DEFAULT_UNFURL_SERVER_URL, defaulting to '/services/unfurl-server'. Only override
// when the default is wrong:
//   - UNFURL_SERVER_URL_PREFIX: explicit override (highest priority)
//   - gui mode (OC_URL set, GITLAB_TOKEN unset): '/' — `unfurl serve --gui`
//     exposes /export, /update_environment, etc. at the root
// Otherwise leave unset so DEFAULT_UNFURL_SERVER_URL falls through to its default.
window.gon = {}
if (process.env.UNFURL_SERVER_URL_PREFIX) {
    window.gon.unfurl_server_url = process.env.UNFURL_SERVER_URL_PREFIX
} else if (process.env.OC_URL && !process.env.GITLAB_TOKEN) {
    window.gon.unfurl_server_url = '/'
}
