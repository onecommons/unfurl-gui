import _ from 'lodash'

export function customMerge(objValue, srcValue, key, object, src, stack) {
    if(typeof srcValue == 'object') {
        if(Array.isArray(srcValue)) {
            const result = []
            for(const source of srcValue) {
                let target
                if(source.name) {
                    if(target = objValue?.find(t => t.name == source.name)) {
                        result.push(_.mergeWith(target, source, customMerge))
                    } else {
                        result.push(source)
                    }
                }
            }

            if(result.length) return result
        }
    }
}

export function applyRequirementsFilter(type, filter) {
    _.mergeWith(type.requirements, filter, customMerge)
}

export function applyInputsSchema(type, inputsSchema) {
    _.merge(type.inputsSchema, inputsSchema)

    for(const key in type.inputsSchema.properties) {
        let computedPropertiesSchema
        if(computedPropertiesSchema = type.computedPropertiesSchema) {
            if(computedPropertiesSchema.properties.hasOwnProperty(key)) {
                delete type.inputsSchema.properties[key]
                continue
            }
        }

        if(type.inputsSchema.properties[key] === null) {
            delete type.inputsSchema.properties[key]
        }
    }

}
