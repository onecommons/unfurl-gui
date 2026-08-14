import _ from 'lodash'
import getData from './raw-data'

function typeToTemplateParams(type) {
  const location_host = location.host
  const [localName, packageSpec] = type.name.split('@')
  const [packageId, modulePath] = packageSpec?.split(':') || []

  const module = modulePath?.replace(/\//g, '.')
  const [host] = packageId?.split('/') || []
  const project = packageId?.split('/')?.pop()
  const namespace = packageId?.split('/')?.slice(1,-1)?.join('.')


  const templateParams = {
    host: host || location_host,
    location_host,
    type: localName,
    module,
    project,
    namespace
  }

  // avoid generating an invalid url
  if(Object.values(templateParams).some(param => !param)) {
    return null
  }

  return templateParams
}

export default async function getFormattedData() {
  const {ResourceType, Overview} = (await getData())
  const types = Object.values(ResourceType)

  const {documentation_url_template} = Overview

  const template = _.template(documentation_url_template, {
    evaluate: false,
    imports: false,
    escape: false,
    variable: false,
    interpolate: /{([\s\S]+?)}/g
  })


  return types.map(type => {
    // beware of n^2
    if(type.metadata?.alias || type.metadata?.deprecated) {
      return
    }

    if(
      type.implementation_requirements?.length > 0 &&
        type.extends.length >= 2 &&
        !type.extends[1].startsWith('tosca.nodes')

    ) {
      const directParent = type.extends[1]

      types.forEach(otherType => {
        if(
          otherType.icon &&
            otherType.implementation_requirements?.length == 0 &&
            otherType.extends.includes(directParent)
        ) {
          type.genericIcon = otherType.icon
        }
      })
    }

    if(type.metadata?.components) {
      type.metadata.components = type.metadata.components.map(component => ResourceType[component]).filter(t => !!t)
    }

    if(!type.details_url) {
      const params = typeToTemplateParams(type)
      if(params) {
        type.details_url = template(params)
        console.log(type.details_url)
      }
    }

    let category = type.metadata?.category

    if(!category) {
      for(const ancestor of type.extends) {
        category = ResourceType[ancestor]?.metadata?.category

        if(category) break
      }
    }

    if(category && type.implementations.length > 0 ) {
      if(category == 'app' && !type.implementations.includes('connect')) { // this is an abstract type
        return
      }
      return {
        category,
        type,
        cloud: _.first(type.implementation_requirements) || 'unassociated'
      }
    }
  }).filter(type => !!type)
}
