/*
 * The four inputs the fork builds and standalone compiles out:
 * LocalImageRepoSource, UnfurlCloudMirroredRepoImageSource,
 * GithubMirroredRepoImageSource and UnfurlCNamedDNSZone. They are the last
 * element-ui holdouts, and no standalone route renders them, so without this
 * page they would be converted with nothing watching.
 *
 * The page is src/pages/fork-inputs -- see vue.config.js. Its own page rather
 * than the gallery's because these need gon.unfurl_gui false, and its GitLab
 * calls are answered by an axios adapter installed in the entry rather than by
 * cy.intercept, because two of them fetch from data() and from an immediate
 * watcher.
 */

const ENTRIES = [
  'local-image-repo-source',
  'uc-mirrored-repo-image-source',
  'uc-mirrored-repo-image-source-readonly',
  'github-mirrored-repo-image-source',
  'unfurl-cnamed-dns-zone',
  'unfurl-cnamed-dns-zone-verifying',
]

const entry = name => `[data-testid="fork-inputs-${name}"]`
// the same field testid appears in both uc entries, so every selector for one
// has to be scoped to its entry
const field = (name, testid) => `${entry(name)} [data-testid="${testid}"]`

describe('fork-only inputs', () => {
  const pageErrors = []

  before(() => {
    Cypress.on('window:before:load', win => {
      win.addEventListener('error', e => pageErrors.push(e.message))
    })
    Cypress.on('uncaught:exception', err => { pageErrors.push(err.message); return false })
    cy.visitBuiltPage('fork-inputs.html')
    cy.get('[data-testid="fork-inputs-unfurl-cnamed-dns-zone"]', {timeout: 20000}).should('exist')
  })

  ENTRIES.forEach(name => {
    it(`renders ${name}`, () => {
      cy.get(`[data-testid="fork-inputs-${name}-error"]`).should('not.exist')
      cy.get(`[data-testid="fork-inputs-${name}"]`).should('be.visible')
      // these are async components: the wrapper exists before the component
      // resolves, so asserting it alone passes against an empty entry
      cy.get(`[data-testid="fork-inputs-${name}"] > :not(.gallery-title)`).should('exist')
      cy.screenshotElement(`[data-testid="fork-inputs-${name}"]`, `fork-inputs/${name}`)
    })
  })

  /*
   * The combobox that replaced el-autocomplete.
   *
   * Typed into on the GitHub widget, whose suggestions come from the already
   * loaded import handler. The two project fields look like better subjects
   * and are not: their watchers call fetchProjectInfo on every keystroke, so
   * typing a partial name asks the API for a project called "m". That is the
   * fork's behaviour today, not something this conversion introduced, but it
   * makes those fields useless for driving the combobox from a test.
   */
  const GH_PROJECT = field('github-mirrored-repo-image-source', 'oc-input-github-project')

  it('suggests repositories as the field is typed into', () => {
    cy.get(`${GH_PROJECT} input`).clear().type('spoon')
    cy.get(`${GH_PROJECT} [data-testid="combobox-result"]`)
      .should('have.length', 1)
      .and('contain.text', 'octocat/spoon-knife')
    cy.screenshotElement(entry('github-mirrored-repo-image-source'), 'fork-inputs/github-project-suggestions')
  })

  it('fills the field from the suggestion and closes the list', () => {
    cy.get(`${GH_PROJECT} [data-testid="combobox-result"]`).first().click()
    cy.get(`${GH_PROJECT} input`).should('have.value', 'octocat/spoon-knife')
    cy.get(`${GH_PROJECT} [data-testid="combobox-dropdown"]`).should('not.be.visible')
  })

  it('offers the branches of the selected project', () => {
    // the UnfurlCloud widget's branch list, which arrives over REST -- the
    // container images in LocalImageRepoSource can come over GraphQL, and the
    // apollo client is a hard null in a standalone build
    const branch = field('uc-mirrored-repo-image-source', 'oc-input-uc-branch')
    cy.get(`${branch} input`).clear().type('s')
    cy.get(`${branch} [data-testid="combobox-result"]`)
      .should('have.length', 1)
      .and('contain.text', 'staging')
  })

  /*
   * Worth asserting rather than leaving implicit: el-autocomplete opened its
   * whole list on focus and GlFormCombobox shows nothing until the field has
   * a value, which is the one behaviour this conversion changes.
   */
  it('shows no suggestions for an empty field', () => {
    cy.get(`${GH_PROJECT} input`).clear().focus()
    cy.get(`${GH_PROJECT} [data-testid="combobox-dropdown"]`).should('not.be.visible')
  })

  it('renders the readonly variant as disabled fields', () => {
    // GlFormCombobox has no disabled prop, so readonly renders a plain input
    cy.get(`${field('uc-mirrored-repo-image-source-readonly', 'oc-input-uc-project')} input`)
      .should('be.disabled')
      .and('have.value', 'onecommons/blueprints/media-service')
  })

  it('verifies a CNAME', () => {
    const dns = entry('unfurl-cnamed-dns-zone')
    cy.get(`${dns} [data-testid="dns-check-cname"]`).click()
    cy.get(`${dns} [data-testid="dns-check-cname"]`)
      .should('contain.text', 'CNAME was verified successfully')
    cy.screenshotElement(dns, 'fork-inputs/dns-verified')
  })

  it('badges each nameserver that has resolved while verifying', () => {
    // this card's domain is the one the stub never fully resolves, so it parks
    // in the verifying state instead of clearing the badges on success
    const dns = entry('unfurl-cnamed-dns-zone-verifying')
    cy.get(`${dns} [data-testid="dns-check-cname"]`).click()
    cy.get(`${dns} [data-testid="dns-check-cname"]`).should('contain.text', 'Verifying CNAME')
    cy.get(`${dns} .gl-badge`).should('have.length', 1).and('contain.text', 'ns1.gallery.test')
    cy.screenshotElement(dns, 'fork-inputs/dns-verifying')
  })

  it('reaches no unstubbed endpoint', () => {
    // a component left waiting on a rejected fetch renders an empty state that
    // still screenshots cleanly, so the miss has to be asserted directly
    cy.window().then(win => {
      expect(win.__forkInputsMisses || []).to.deep.equal([])
    })
    cy.then(() => {
      cy.task('log', `[fork-inputs] page errors: ${JSON.stringify(pageErrors.slice(0, 8))}`)
    })
  })
})
