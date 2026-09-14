// webpack turns an image import into a URL; jest has no transform that would
// survive one, so every image resolves to this.
module.exports = 'test-file-stub'
