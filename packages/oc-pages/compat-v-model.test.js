// A component with compatConfig COMPONENT_V_MODEL: false turns off the compat
// bridge that delivers its update:modelValue to a caller's v-model, so a
// v-model on it drops every update without an error (see CLAUDE.md, "A
// component on the Vue 3 v-model contract cannot be bound with v-model").
// vue-tsc cannot see compat config, so this checks the templates instead.
const fs = require('fs')
const path = require('path')

function vueFiles(dir, out = []) {
    for(const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if(entry.name == 'node_modules') continue
        const full = path.join(dir, entry.name)
        if(entry.isDirectory()) vueFiles(full, out)
        else if(entry.name.endsWith('.vue')) out.push(full)
    }
    return out
}

const kebab = name => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const pascal = name => name.replace(/(^|-)(\w)/g, (_, _d, c) => c.toUpperCase())

const files = vueFiles(__dirname).map(file => ({file, source: fs.readFileSync(file, 'utf8')}))
const severed = files
    .filter(({source}) => /compatConfig:\s*\{[^}]*COMPONENT_V_MODEL:\s*false/.test(source))
    .map(({file}) => kebab(path.basename(file, '.vue')))

// every opening tag for the component, attributes and all
function tagsOf(name, source) {
    const re = new RegExp(`<(?:${name}|${pascal(name)})(?=[\\s/>])[^>]*>`, 'g')
    return source.match(re) || []
}

it('finds the components that turn the bridge off', () => {
    expect(severed.length).toBeGreaterThan(0)
})

it.each(severed)('%s is used somewhere, so the check below sees its callers', name => {
    expect(files.some(({source}) => tagsOf(name, source).length > 0)).toBe(true)
})

it.each(severed)('no caller binds %s with v-model', name => {
    const offenders = files.flatMap(({file, source}) =>
        tagsOf(name, source).filter(tag => /\sv-model[\s=.:]/.test(tag)).map(tag => `${path.relative(__dirname, file)}: ${tag}`))
    expect(offenders).toEqual([])
})
