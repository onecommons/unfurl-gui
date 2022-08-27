// Enable mocking in vue.config.js with `"pluginOptions": { "enableMocks": true }`
// Customize mocking: https://www.apollographql.com/docs/graphql-tools/mocking.html#Customizing-mocks

const unfurl_json = require("./unfurl.json");
/*
function* resourceTypeIter() {
  let i = 0;
  const values = [
    {name: 'Compute'},
    {name: 'MongoDB'},
    {name: 'DNS'}, 
    {name: 'Mail'}, 
  ]
  while(true) {
    const value =  values[i++ % values.length]
    console.log({value})
    yield value
  }
}

const resourceTypes = resourceTypeIter()

*/

function* sampleFrom(arr) {
  let i = 0;
  while(true) {
    const value =  arr[i++ % arr.length]
    yield value
  }
}

const resourceNames = sampleFrom(['Compute', 'MongoDB', 'DNS', 'Mail'])


export default {
  // Mock resolvers here
  JSON: () => ({ mocked: "mocked JSON" }),
  
  Environment: () => ({
    "id": "gid://gitlab/Environment/1",
    "name": "mock environment",
    "path": "/root/test/-/environments/1",
    "state": "available",
  }),
  
  String: (_0, _1, _2, {path}) => {
    const {key, typename} = path
    if(key == 'name' && typename == 'ResourceType') {
      const result = resourceNames.next()
      return result.value

    }
    return `Hello ${typename}.${key}`
  }

  /*
  ResourceType: (...args) => {
    console.log(args[3])
    return resourceTypes.next()
  }
  */

  
  /*
  Template: () => ({
    resource_templates: () => unfurl_json["templates"][0]["resource_templates"]
  }),

  TemplateInput: () => ({
    resource_templates: () => unfurl_json["templates"][0]["resource_templates"]
  }),

  Resource: () => ({
    requirements: () => unfurl_json["resources"][0]["requirements"]
  }),

  Overview: () => {
    const mock = ({
    inputs: [...new Array(2)],
    outputs: [...new Array(2)],
    requirements: [...new Array(2)],
    resources: [...new Array(2)],
    servicesToConnect: [...new Array(2)],
    ...unfurl_json["projectInfo"]
    })
    console.log({ mock });
    return mock;
  }, */
}


