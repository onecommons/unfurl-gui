import FileTree from './file-tree.vue'
import { mount } from '@vue/test-utils'

// @gitlab/ui ships untransformed esm and jest does not transpile node_modules here.
// The stub keeps gl-icon's own data-testid so these assertions describe the real one.
jest.mock('@gitlab/ui', () => ({
  GlIcon: {
    props: {name: String},
    render(h) {
      return h('span', {attrs: {'data-testid': `${this.name}-icon`}})
    }
  }
}))

// shaped like file-selector's treeDisplayData: a root wrapper that is neither
// selectable nor expandable, holding a folder, an empty folder and a file
function makeNodes({directoriesAllowed = false} = {}) {
  return [
    {
      id: '/',
      text: 'jest/dashboard',
      selectable: false,
      checkable: directoriesAllowed,
      expandable: false,
      state: {expanded: true},
      nodes: [
        {
          id: '//environments',
          text: 'environments',
          selectable: false,
          checkable: directoriesAllowed,
          expandable: true,
          state: {},
          nodes: [
            {
              id: '//environments/config.yaml',
              text: 'config.yaml',
              selectable: true,
              checkable: true,
              expandable: false,
              state: {}
            }
          ]
        },
        {
          id: '//empty',
          text: 'empty',
          selectable: false,
          checkable: directoriesAllowed,
          expandable: true,
          state: {},
          nodes: []
        },
        {
          id: '//README.md',
          text: 'README.md',
          selectable: true,
          checkable: true,
          expandable: false,
          state: {}
        }
      ]
    }
  ]
}

function mountTree(options = {}) {
  return mount(FileTree, {
    propsData: {nodes: makeNodes(options), selected: null, ...options.propsData}
  })
}

// scoped to the node's own row - a node contains the rows of its descendants too
function row(wrapper, id) {
  return wrapper.find(`[data-id="${id}"] > .file-tree-row`)
}

function iconOf(wrapper, id) {
  // scoped to the kind icon: the chevron is also a gl-icon, and comes first
  const icon = row(wrapper, id).find('.file-tree-icon')
  return icon.exists()? icon.attributes('data-testid').replace(/-icon$/, ''): null
}

function chevronOf(wrapper, id) {
  const icon = row(wrapper, id).find('.file-tree-chevron [data-testid$="-icon"]')
  return icon.exists()? icon.attributes('data-testid').replace(/-icon$/, ''): null
}

function visibleIds(wrapper) {
  return wrapper.findAll('[data-testid="file-tree-node"]').map(w => w.attributes('data-id'))
}

describe('file tree component', () => {
  it('renders the root expanded and its descendants collapsed', () => {
    const wrapper = mountTree()

    expect(visibleIds(wrapper)).toEqual(['/', '//environments', '//empty', '//README.md'])
  })

  it('expands and collapses a folder when its row is clicked', async () => {
    const wrapper = mountTree()

    await row(wrapper, '//environments').trigger('click')
    expect(visibleIds(wrapper)).toContain('//environments/config.yaml')

    await row(wrapper, '//environments').trigger('click')
    expect(visibleIds(wrapper)).not.toContain('//environments/config.yaml')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('does not expand a folder with no children', async () => {
    const wrapper = mountTree()

    await row(wrapper, '//empty').trigger('click')
    expect(visibleIds(wrapper)).toEqual(['/', '//environments', '//empty', '//README.md'])
  })

  it('emits the node id when a file row is clicked', async () => {
    const wrapper = mountTree()

    await row(wrapper, '//README.md').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['//README.md']])
  })

  it('emits the node id when a checkbox is clicked', async () => {
    const wrapper = mountTree()

    await row(wrapper, '//README.md').find('input[type="checkbox"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['//README.md']])
  })

  it('emits null when the selected node is clicked again', async () => {
    const wrapper = mountTree({propsData: {selected: '//README.md'}})

    await row(wrapper, '//README.md').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[null]])
  })

  it('checks only the selected node', async () => {
    const wrapper = mountTree()

    const checked = () => wrapper.findAll('input[type="checkbox"]')
      .filter(w => w.element.checked)
      .map(w => w.element.closest('[data-id]').dataset.id)

    expect(checked()).toEqual([])

    await wrapper.setProps({selected: '//README.md'})
    expect(checked()).toEqual(['//README.md'])

    await wrapper.setProps({selected: null})
    expect(checked()).toEqual([])
  })

  it('emits the id of a nested node through every level of the recursion', async () => {
    const wrapper = mountTree()

    await row(wrapper, '//environments').trigger('click')
    await row(wrapper, '//environments/config.yaml').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['//environments/config.yaml']])
  })

  it('offers a checkbox for directories only when they are checkable', () => {
    expect(row(mountTree(), '//environments').find('input[type="checkbox"]').exists()).toBe(false)

    const allowed = mountTree({directoriesAllowed: true})
    expect(row(allowed, '//environments').find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('shows a folder icon for directories, a doc icon for files and none for the root', async () => {
    const wrapper = mountTree()

    expect(iconOf(wrapper, '/')).toBe(null)
    expect(iconOf(wrapper, '//README.md')).toBe('doc-text')
    expect(iconOf(wrapper, '//environments')).toBe('folder-o')

    await row(wrapper, '//environments').trigger('click')
    expect(iconOf(wrapper, '//environments')).toBe('folder-open')
  })

  it('puts the checkbox ahead of the icon and the name', () => {
    const wrapper = mountTree()
    const cells = [...row(wrapper, '//README.md').element.children]
    const check = cells.findIndex(c => c.querySelector('input[type="checkbox"]'))
    const text = cells.findIndex(c => c.classList.contains('file-tree-text'))

    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(text)
  })

  it('shows a chevron only on rows that can actually expand', () => {
    const wrapper = mountTree()

    // an empty folder draws the same folder icon but cannot open, so the
    // chevron is the only thing that tells them apart
    expect(iconOf(wrapper, '//empty')).toBe('folder-o')
    expect(chevronOf(wrapper, '//empty')).toBe(null)

    expect(chevronOf(wrapper, '//environments')).toBe('chevron-right')
    expect(chevronOf(wrapper, '//README.md')).toBe(null)
    expect(chevronOf(wrapper, '/')).toBe(null)
  })

  it('turns the chevron down when a folder opens', async () => {
    const wrapper = mountTree()

    await row(wrapper, '//environments').trigger('click')
    expect(chevronOf(wrapper, '//environments')).toBe('chevron-down')
  })
})
