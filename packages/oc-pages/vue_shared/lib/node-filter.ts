import _ from 'lodash'

// The unfurl export JSON; typed loosely until the payload types exist.
type Json = Record<string, any>

// A lodash mergeWith customizer: lists of named entries merge by name.
export function customMerge(objValue: any, srcValue: any) {
    if(typeof srcValue == 'object') {
        if(Array.isArray(srcValue)) {
            const result: Json[] = []
            for(const source of srcValue) {
                let target
                if(source.name) {
                    if(target = objValue?.find((t: Json) => t.name == source.name)) {
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

export function applyRequirementsFilter(type: Json, filter: Json[]) {
    _.mergeWith(type.requirements, filter, customMerge)
}

export function applyInputsSchema(type: Json, inputsSchema: Json) {
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
