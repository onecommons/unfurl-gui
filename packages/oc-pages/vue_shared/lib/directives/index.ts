import _generate from './generate'


const resolutionMap: Record<string, ((value: any) => unknown) | undefined> = {
    _generate
}

export function resolverName(directive: unknown) {
    let entries: [string, unknown][] = []
    try {
        entries = Object.entries(directive as object)
    } catch(e) {}
    if(entries.length == 1) {
        const [entry] = entries
        const [key] = entry
        if(!resolutionMap[key]) { return null }
        return key
    }
    return null
}

export function tryResolveDirective(directive: unknown) {
    let entries: [string, unknown][] = []
    try {
        entries = Object.entries(directive as object)
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
