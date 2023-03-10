import _generate from './generate'


const resolutionMap = {
    _generate
}

export function resolverName(directive) {
    let entries = []
    try {
        entries = Object.entries(directive)
    } catch(e) {}
    if(entries.length == 1) {
        const [entry] = entries
        const [key, value] = entry
        let resolver
        if(!(resolver = resolutionMap[key])) { return null }
        return key
    }
    return null
}

export function tryResolveDirective(directive) {
    let entries = []
    try {
        entries = Object.entries(directive)
    } catch(e) {}
    if(entries.length == 1) {
        const [entry] = entries
        const [key, value] = entry
        let resolver
        if(!(resolver = resolutionMap[key])) { return null }
        return resolver(value)
    }
    return null
}
