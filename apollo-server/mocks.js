// Enable mocking in vue.config.js with `"pluginOptions": { "enableMocks": true }`
// Customize mocking: https://www.apollographql.com/docs/graphql-tools/mocking.html#Customizing-mocks

const unfurl_json = require("./unfurl.json");

export default {
  // Mock resolvers here
  JSON: () => ({ mocked: "mocked JSON" }),
  
  Environment: () => ({
    "id": "gid://gitlab/Environment/1",
    "name": "mock environment",
    "path": "/root/test/-/environments/1",
    "state": "available",
  }),
  
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


