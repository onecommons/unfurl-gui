export function filterFromRoutes(routes) {
    const routesTable = {}
    for(const route of routes) {
        routesTable[route.name] = route.public === false
    }

    return function(to) {
        return routesTable[to.name]
    }
}

function filterFromRegex(regex) {
    return function(to) {
        const result = regex.test(to.fullPath)
        return result
    }

}

export function createDenyList(...filters) {
    const list = []
    for(const filter of filters) {
        if(typeof filter?.test == 'function') {
            list.push(filterFromRegex(filter))
        } else if (typeof filter == 'function'){
            list.push(filter)
        }
    }
    return function(to) {
        return list.some(f => f(to))
    }
}
