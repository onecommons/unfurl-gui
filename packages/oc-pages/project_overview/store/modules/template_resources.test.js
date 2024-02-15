import { createLocalVue, shallowMount } from '@vue/test-utils'
import Vuex from 'vuex'
import template_resources from './template_resources'

const localVue = createLocalVue()
localVue.use(Vuex)

function createStore(mockGetters) {
    return new Vuex.Store({
        modules: {
            mock: {
                getters: mockGetters
            },
            template_resources: {
                getters: {
                    resolveResourceTypeFromAny: template_resources.getters.resolveResourceTypeFromAny
                }
            }
        }
    })
}

describe('resolveResourceTypeFromAny', () => {
    it('Can avoid returning an incomplete type', () => {
        const store = createStore(nextcloudMockGetters)
        expect(store.getters.resolveResourceTypeFromAny("Nextcloud")).toEqual(store.getters.resolveResourceType("Nextcloud"))
    })

    it('Can handle a missing type', () => {
        const mockGetters = {
            ...nextcloudMockGetters,
            resolveResourceType() {
                return () => null
            }
        }

        const store = createStore(mockGetters)

        expect(store.getters.resolveResourceTypeFromAny("Nextcloud")).toEqual(store.getters.environmentResolveResourceType("foo", "Nextcloud"))
    })
})


const nextcloudMockGetters = {
    resolveResourceType() {
        return () => ({
            "name": "Nextcloud@unfurl.cloud/onecommons/blueprints/nextcloud",
            "title": "Nextcloud",
            "description": "",
            "__typename": "ResourceType",
            "extends": [
                "Nextcloud@unfurl.cloud/onecommons/blueprints/nextcloud",
                "unfurl.nodes.WebApp@unfurl.cloud/onecommons/unfurl-types",
                "unfurl.nodes.ContainerApp@unfurl.cloud/onecommons/unfurl-types",
                "unfurl.nodes.App@unfurl.cloud/onecommons/unfurl-types",
                "tosca.nodes.Root",
                "tosca.capabilities.Node",
                "tosca.capabilities.Root"
            ],
            "requirements": [
                {
                    "name": "container",
                    "description": "",
                    "__typename": "RequirementConstraint",
                    "min": 1,
                    "max": 1,
                    "visibility": "hidden",
                    "match": "container_service",
                    "resourceType": "unfurl.nodes.ContainerService@unfurl.cloud/onecommons/unfurl-types",
                    "_utilization": 1,
                    "title": "container"
                },
                {
                    "name": "mail",
                    "description": "Mail server for user registration and notifications (can be configured after deployment)",
                    "__typename": "RequirementConstraint",
                    "title": "Mail Server",
                    "min": 0,
                    "max": 1,
                    "match": null,
                    "resourceType": "SMTPServer@unfurl.cloud/onecommons/unfurl-types",
                    "_utilization": 1
                },
                {
                    "name": "db",
                    "description": "External database for Nextcloud (optional)",
                    "__typename": "RequirementConstraint",
                    "title": "Database Instance",
                    "min": 0,
                    "max": 1,
                    "match": null,
                    "resourceType": "PostgresDB@unfurl.cloud/onecommons/unfurl-types",
                    "inputsSchema": {
                        "properties": {
                            "database_name": null
                        }
                    },
                    "_utilization": 1
                },
                {
                    "name": "redis",
                    "description": "External cache for Nextcloud (optional)",
                    "__typename": "RequirementConstraint",
                    "title": "Redis Cache",
                    "min": 0,
                    "max": 1,
                    "match": null,
                    "resourceType": "Redis@unfurl.cloud/onecommons/unfurl-types",
                    "_utilization": 1
                }
            ],
            "inputsSchema": {
                "type": "object",
                "properties": {
                    "database_name": {
                        "title": "Database Name",
                        "default": "nextcloud",
                        "required": true,
                        "description": "Preferred name for PostgresDB database",
                        "user_settable": true,
                        "type": "string"
                    },
                    "from_address": {
                        "title": "Email Address",
                        "description": "Use this address for the 'from' field in the emails sent by Nextcloud.",
                        "type": "string"
                    },
                    "mail_domain": {
                        "title": "Mail Domain",
                        "description": "Set a different domain for the emails than the domain where Nextcloud is installed.",
                        "type": "string"
                    },
                    "subdomain": {
                        "title": "Subdomain",
                        "default": "nextcloud",
                        "required": true,
                        "description": "Choose a subdomain for your deployment. A subdomain of 'www', will be at www.your.domain",
                        "user_settable": true,
                        "type": "string",
                        "pattern": "^[a-z0-9]([-a-z0-9]*[a-z0-9])*$"
                    }
                }
            },
            "implementations": [
                "create"
            ],
            "implementation_requirements": [],
            "visibility": "inherit",
            "computedPropertiesSchema": {
                "type": "object",
                "properties": {
                    "health_check_url": {
                        "title": "health_check_url",
                        "required": true,
                        "export": true,
                        "hidden": true,
                        "type": "string",
                        "visibility": "hidden"
                    },
                    "readiness_estimate": {
                        "title": "readiness_estimate",
                        "required": true,
                        "description": "Guesstimate when we can expect the deployed app to be ready (in seconds)",
                        "export": true,
                        "hidden": true,
                        "$toscatype": "integer",
                        "type": "number",
                        "visibility": "hidden"
                    }
                }
            },
            "outputsSchema": {
                "type": "object",
                "properties": {}
            },
            "_localName": "Nextcloud",
            "metadata": {},
            "_maxUtilization": 1,
            "_normalized": true
        })
    },
    environmentResolveResourceType() {
        return () => ({
            "name": "Nextcloud@unfurl.cloud/onecommons/blueprints/nextcloud",
            "title": "Nextcloud",
            "extends": [
                "Nextcloud@unfurl.cloud/onecommons/blueprints/nextcloud",
                "unfurl.nodes.WebApp@unfurl.cloud/onecommons/unfurl-types",
                "unfurl.nodes.ContainerApp@unfurl.cloud/onecommons/unfurl-types",
                "unfurl.nodes.App@unfurl.cloud/onecommons/unfurl-types",
                "tosca.nodes.Root",
                "tosca.capabilities.Node",
                "tosca.capabilities.Root"
            ],
            "_sourceinfo": {
                "file": "ensemble-template.yaml#spec/service_template",
                "url": "https://unfurl.cloud/onecommons/blueprints/nextcloud.git",
                "incomplete": true
            },
            "description": "A safe home for all your data. Access & share your files, calendars, contacts, mail & more from any device, on your terms.",
            "implementations": [
                "connect",
                "create"
            ],
            "directives": [
                "substitute"
            ],
            "icon": "https://unfurl.cloud/uploads/-/system/project/avatar/111/avatar.png",
            "__typename": "ResourceType",
            "_localName": "Nextcloud",
            "requirements": [],
            "metadata": {},
            "_maxUtilization": 1,
            "_normalized": true
        })
    },
}
