function indexWithPath(object, path) {
    let currentValue = object
    for(let index of path) {
        currentValue = currentValue[index]
        if(!currentValue) return null 
    }
    return currentValue
}

export function textValueFromKeys(..._keys) {
    const paths = _keys.map(key => key.split('.'))
    return function(item) {
        const components = []
        for(const path of paths) {
            components.push(indexWithPath(item, path) || '')
        }
        const result = components.join(':')
        return result
    }

}
