/*
 * Screenshots the components 2A.2 rewrites that no route the specs visit
 * renders: autostop, deployment-scheduler, github-auth, import-*,
 * experimental-settings-input and the two public_cloud controls.
 *
 * The page is src/pages/gallery -- see vue.config.js. Each component is
 * screenshotted on its own so a diff names the component that moved, and each
 * is wrapped in an error boundary so one throwing component does not cost the
 * other eight their screenshots.
 */

const ENTRIES = [
  'autostop',
  'autostop-inner',
  'deployment-scheduler',
  'github-auth',
  'github-auth-loading',
  'import-button',
  'import-link',
  'experimental-settings-input',
  'file-selector',
  'cloud-table',
  'map-controls',
]

/*
 * autostop-inner derives its default date and time from Date.now() in data(),
 * so anything rendering it drifts without a frozen clock. Cypress restores the
 * clock after every test, and the popover builds its own autostop-inner when
 * it opens -- so this has to run per test, not once. Only Date is stubbed;
 * stubbing timers as well breaks popper and Vue's nextTick.
 */
const freezeClock = () => cy.clock(new Date('2026-03-04T10:20:00Z').getTime(), ['Date'])

describe('component gallery', () => {
  const pageErrors = []

  beforeEach(freezeClock)

  before(() => {
    Cypress.on('window:before:load', win => {
      win.addEventListener('error', e => pageErrors.push(e.message))
    })
    Cypress.on('uncaught:exception', err => { pageErrors.push(err.message); return false })
    freezeClock()
    // file-selector builds its tree from a flat file list over two endpoints
    cy.intercept('GET', '**/repository/branches', [{name: 'main', default: true}])
    cy.intercept('GET', '**/-/files/**', [
      'README.md',
      'ensemble-template.yaml',
      'configs/nginx.conf',
      'configs/tls/cert.pem',
      'configs/tls/key.pem',
      'service/main.py',
      'service/requirements.txt',
    ])
    cy.visitBuiltPage('gallery.html')
    cy.get('[data-testid="gallery-map-controls"]', {timeout: 20000}).should('exist')
  })

  ENTRIES.forEach(name => {
    it(`renders ${name}`, () => {
      // a boundary that caught something renders the message instead of the
      // component, which is a failure worth naming rather than screenshotting
      cy.get(`[data-testid="gallery-${name}-error"]`).should('not.exist')
      cy.get(`[data-testid="gallery-${name}"]`).should('be.visible')
      // an async component leaves the wrapper holding only its title until it
      // resolves, so asserting the wrapper alone passes against an empty entry
      cy.get(`[data-testid="gallery-${name}"] > :not(.gallery-title)`).should('exist')
      cy.screenshotElement(`[data-testid="gallery-${name}"]`, `gallery/${name}`)
    })
  })

  it('shows the public cloud help tooltip', () => {
    cy.get('[data-testid="public-cloud-help"]').trigger('mouseenter')
    cy.get('.gl-tooltip').should('be.visible').and('contain.text', 'open-source')
    // a page shot, like the other tooltip captures: the tooltip sits above
    // its icon and an element shot of the entry clips it
    cy.screenshotPage('gallery/cloud-table-tooltip')
    cy.get('[data-testid="public-cloud-help"]').trigger('mouseleave')
  })

  it('shows the import-link popover', () => {
    // it holds links, so it has to be a popover -- and only exists on hover
    cy.get('[data-testid="import-link-trigger"]').trigger('mouseenter')
    cy.get('.popover').should('be.visible').and('contain.text', 'Shared from')
    cy.screenshotPage('gallery/import-link-popover')
    cy.get('[data-testid="import-link-trigger"]').trigger('mouseleave')
    cy.get('.popover').should('not.exist')
  })

  /*
   * The file tree. Every test here shares one page load, so each opens the
   * picker and closes it again; Cancel and Confirm both return it to the
   * closed state, because the gallery never feeds the emitted value back in
   * as `value`. Closing destroys the tree, so expansion and selection reset
   * on their own and no test has to undo its own clicks.
   *
   * Node ids are the tree's own paths. The repository root is '/', so its
   * children are '//README.md', '//configs' and so on.
   */
  const TREE = '[data-testid="file-selector-tree"]'
  const treeRow = id => cy.get(`${TREE} [data-id="${id}"]`).children('.file-tree-row')
  const checkedBoxes = () => cy.get(`${TREE} input[type="checkbox"]:checked`)

  function openPicker() {
    cy.get('[data-testid="file-selector-choose"]').click()
    cy.get(TREE).should('be.visible')
  }

  function closePicker() {
    cy.get('[data-testid="file-selector-cancel"]').click()
    cy.get(TREE).should('not.exist')
  }

  it('browses the file tree', () => {
    openPicker()
    // the root is expanded, everything below it starts collapsed
    treeRow('//configs').should('be.visible')
    cy.get(`${TREE} [data-id="//configs/tls"]`).should('not.exist')
    cy.screenshotElement('[data-testid="gallery-file-selector"]', 'gallery/file-selector-tree')

    treeRow('//configs').click()
    treeRow('//configs/nginx.conf').should('be.visible')
    treeRow('//configs/tls').click()
    treeRow('//configs/tls/cert.pem').should('be.visible')
    treeRow('//configs/tls/key.pem').should('be.visible')
    cy.screenshotElement('[data-testid="gallery-file-selector"]', 'gallery/file-selector-expanded')

    // collapsing the inner folder leaves the outer one open
    treeRow('//configs/tls').click()
    cy.get(`${TREE} [data-id="//configs/tls/cert.pem"]`).should('not.exist')
    treeRow('//configs/nginx.conf').should('be.visible')

    treeRow('//configs').click()
    cy.get(`${TREE} [data-id="//configs/nginx.conf"]`).should('not.exist')
    // expanding never selects anything
    checkedBoxes().should('have.length', 0)
    closePicker()
  })

  it('draws an icon for every row but the root', () => {
    openPicker()
    treeRow('//README.md').find('[data-testid="doc-text-icon"]').should('be.visible')
    treeRow('//configs').find('[data-testid="folder-o-icon"]').should('be.visible')
    treeRow('//configs').click()
    treeRow('//configs').find('[data-testid="folder-open-icon"]').should('be.visible')
    // the root row names the repository and carries no icon
    treeRow('/').should('contain.text', 'onecommons/blueprints/gallery')
      .find('[data-testid$="-icon"]').should('not.exist')
    closePicker()
  })

  it('puts the checkbox to the left of the name', () => {
    openPicker()
    treeRow('//README.md').then($row => {
      const box = $row.find('input[type="checkbox"]')[0].getBoundingClientRect()
      const name = $row.find('.file-tree-text')[0].getBoundingClientRect()
      expect(box.right).to.be.lessThan(name.left)
    })
    closePicker()
  })

  it('selects a file by its row and offers to confirm it', () => {
    openPicker()
    cy.get('[data-testid="file-selector-confirm"]').should('not.exist')

    treeRow('//README.md').click()
    treeRow('//README.md').find('input[type="checkbox"]').should('be.checked')
    cy.get('[data-testid="file-selector-confirm"]').should('be.visible')
    cy.screenshotElement('[data-testid="gallery-file-selector"]', 'gallery/file-selector-selected')

    // clicking the selected row again clears it
    treeRow('//README.md').click()
    checkedBoxes().should('have.length', 0)
    cy.get('[data-testid="file-selector-confirm"]').should('not.exist')
    closePicker()
  })

  it('selects by checkbox and holds only one selection at a time', () => {
    openPicker()
    treeRow('//configs').click()

    treeRow('//configs/nginx.conf').find('input[type="checkbox"]').click()
    treeRow('//configs/nginx.conf').find('input[type="checkbox"]').should('be.checked')

    treeRow('//README.md').find('input[type="checkbox"]').click()
    treeRow('//configs/nginx.conf').find('input[type="checkbox"]').should('not.be.checked')
    checkedBoxes().should('have.length', 1)
    treeRow('//README.md').find('input[type="checkbox"]').should('be.checked')

    treeRow('//README.md').find('input[type="checkbox"]').click()
    checkedBoxes().should('have.length', 0)
    closePicker()
  })

  it('checks a directory rather than expanding it when its checkbox is clicked', () => {
    // this schema names no file types, so directoriesAllowed is true and every
    // row is checkable
    openPicker()
    treeRow('//configs').find('input[type="checkbox"]').click()
    treeRow('//configs').find('input[type="checkbox"]').should('be.checked')
    cy.get('[data-testid="file-selector-confirm"]').should('be.visible')
    // the checkbox selects, the row around it still expands
    cy.get(`${TREE} [data-id="//configs/nginx.conf"]`).should('not.exist')
    cy.screenshotElement('[data-testid="gallery-file-selector"]', 'gallery/file-selector-directory')

    treeRow('//configs').click()
    treeRow('//configs/nginx.conf').should('be.visible')
    treeRow('//configs').find('input[type="checkbox"]').should('be.checked')
    closePicker()
  })

  it('closes on confirm and returns to the closed picker', () => {
    openPicker()
    treeRow('//service').click()
    treeRow('//service/main.py').click()

    treeRow('//service/main.py').find('input[type="checkbox"]').should('be.checked')
    cy.get('[data-testid="file-selector-confirm"]').click()
    cy.get(TREE).should('not.exist')
    // the gallery does not feed the emitted value back in, so it reopens empty
    cy.get('[data-testid="file-selector-choose"]').should('be.visible')
    openPicker()
    checkedBoxes().should('have.length', 0)
    closePicker()
  })


  it('opens the autostop preset listbox', () => {
    cy.get('[data-testid="gallery-autostop-inner"] [data-testid="autostop-preset"] button').click()
    cy.get('[role="listbox"]').should('be.visible').and('contain.text', 'In One Week')
    cy.screenshotPage('gallery/autostop-presets')
    cy.get('body').click(1100, 10)
  })

  it('opens the autostop date picker', () => {
    // only reachable once the preset is Custom, which is the default. The
    // trigger is gl-datepicker's calendar button, not the field.
    cy.get('[data-testid="gallery-autostop-inner"] [data-testid="autostop-date"] .gl-datepicker-actions button')
      .click()
    cy.get('.pika-single:not(.is-hidden)').should('be.visible')
    cy.screenshotPage('gallery/autostop-datepicker')
    cy.get('body').click(1000, 10)
  })

  it('opens the autostop popover', () => {
    // The popover only exists once clicked, so no static shot covers it. It is
    // appended to <body> and positioned by popper, so a page shot catches it
    // mid-reposition when the fullPage capture resizes the viewport -- and it
    // lands on top of the entries below it either way. Shoot the panel itself.
    cy.get('[data-testid="autostop-trigger"]').click()
    // clicking leaves the trigger's own tooltip up, covering the panel
    cy.get('[data-testid="autostop-trigger"]').trigger('mouseleave')
    cy.get('.gl-tooltip').should('not.exist')
    cy.get('[data-testid="autostop-popover"]').should('be.visible')
    cy.screenshotElement('[data-testid="autostop-popover"]', 'gallery/autostop-popover')
  })

  after(() => {
    cy.then(() => { cy.task('log', `[gallery] page errors: ${JSON.stringify(pageErrors.slice(0, 8))}`) })
  })

})
