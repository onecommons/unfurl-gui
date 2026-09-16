// Modules under `oc/pages/` live in gitlab-oc's own source tree: the fork build
// resolves them there and standalone compiles the imports out, so jest can
// reach neither copy. compat.js assigns this one at module scope, so it has to
// be callable rather than the plain string jest-file-stub exports.
const forkOnlyStub = function forkOnlyStub() {}

module.exports = forkOnlyStub
module.exports.default = forkOnlyStub
module.exports.__esModule = true
