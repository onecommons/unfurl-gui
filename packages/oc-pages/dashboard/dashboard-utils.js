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
        let missing = 0
        for(const path of paths) {
            const indexed = indexWithPath(item, path)
            if(!indexed) missing += 1
            components.push(indexed)
        }
        if(missing == paths.length) return
        const result = components.join(':')
        return result
    }

}
