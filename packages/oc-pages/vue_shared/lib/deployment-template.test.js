const DeploymentObject1 = () => JSON.parse(`
{ "DeploymentTemplate": { "cy-ghost-official-l67039un": { "name": "cy-ghost-official-l67039un", "title": "Cy ghost-official l67039un", "cloud": "unfurl.relationships.ConnectsTo.AWSAccount", "description": "Deploy using Amazon Elastic Compute Cloud (EC2)", "__typename": "DeploymentTemplate", "slug": "cy-ghost-official-l67039un", "blueprint": "ghost", "primary": "the_app", "resourceTemplates": [ "the_app", "container_service", "db-dockerhost", "redis-dockerhost", "configurator-artifacts", "dockerhost-aws-bootimage", "aws_metadata", "gcp_artifacts", "dockerhost-gcp-bootimage", "gcp_metadata", "__typename", "dockerhost", "__route53dnszone", "compute", "__mail-server" ], "ResourceTemplate": { }, "projectPath": "blueprints/ghost", "source": "aws" } }, "ApplicationBlueprint": { "ghost": { "name": "ghost", "__typename": "ApplicationBlueprint", "title": "Ghost", "primary": "GhostCMS", "deploymentTemplates": [ "gcp", "aws", "cy-ghost-official-l67039un" ], "description": "Ghost is a free and open source CMS blogging platform with a rich editor and powerful customization.", "livePreview": null, "sourceCodeUrl": null, "image": null, "projectIcon": "http://tunnel.abreidenbach.com:3000/assets/uf-avatar-placeholder-1-1cc5be16f82fbd1cc136bbd8cc9c2a4e948f00e30cbb8c79cc3e4755b2120aba.svg", "primaryDeploymentBlueprint": "gcp" } }, "DefaultTemplate": { "configurator-artifacts": { "name": "configurator-artifacts", "type": "unfurl.nodes.LocalRepository", "title": "configurator-artifacts", "description": "", "directives": [ "default" ], "properties": [ { "name": "repository", "value": null }, { "name": "url", "value": null }, { "name": "credential", "value": null } ], "dependencies": [ ], "visibility": "hidden", "__typename": "DefaultTemplate", "computedProperties": [ ] }, "redis-dockerhost": { "name": "redis-dockerhost", "type": "unfurl.nodes.DockerHost", "title": "redis-dockerhost", "description": "This is an incomplete, placeholder template that needs to be defined in your blueprint", "directives": [ "default" ], "properties": [ ], "dependencies": [ ], "visibility": "hidden", "__typename": "DefaultTemplate", "computedProperties": [ ] }, "db-dockerhost": { "name": "db-dockerhost", "type": "unfurl.nodes.DockerHost", "title": "db-dockerhost", "description": "This is an incomplete, placeholder template that needs to be defined in your blueprint", "directives": [ "default" ], "properties": [ ], "dependencies": [ ], "visibility": "hidden", "__typename": "DefaultTemplate", "computedProperties": [ ] }, "aws_metadata": { "name": "aws_metadata", "type": "unfurl.nodes.AWSMetadata", "title": "aws_metadata", "description": "", "directives": [ "default" ], "properties": [ ], "dependencies": [ ], "visibility": "hidden", "__typename": "DefaultTemplate", "computedProperties": [ ] }, "gcp_metadata": { "name": "gcp_metadata", "type": "unfurl.nodes.GCPMetadata", "title": "gcp_metadata", "description": "", "directives": [ "default" ], "properties": [ ], "dependencies": [ ], "visibility": "hidden", "__typename": "DefaultTemplate", "computedProperties": [ ] }, "gcp_artifacts": { "name": "gcp_artifacts", "type": "unfurl.nodes.LocalRepository", "title": "gcp_artifacts", "description": "", "directives": [ "default" ], "properties": [ { "name": "repository", "value": null }, { "name": "url", "value": null }, { "name": "credential", "value": null } ], "dependencies": [ ], "visibility": "hidden", "__typename": "DefaultTemplate", "computedProperties": [ ] }, "dockerhost-aws-bootimage": { "name": "dockerhost-aws-bootimage", "type": "unfurl.nodes.AMIBootImage", "title": "dockerhost-aws-bootimage", "description": "", "directives": [ "default" ], "properties": [ { "name": "owner", "value": "099720109477" }, { "name": "name_regex", "value": "focal" } ], "dependencies": [ { "constraint": { "name": "configures", "title": "configures", "description": "", "min": 0, "max": 1, "match": null, "resourceType": "tosca.nodes.Root", "visibility": "visible" }, "name": "configures", "__typename": "Requirement" } ], "visibility": "hidden", "__typename": "DefaultTemplate", "computedProperties": [ ] }, "dockerhost-gcp-bootimage": { "name": "dockerhost-gcp-bootimage", "type": "unfurl.nodes.GCPBootImage", "title": "dockerhost-gcp-bootimage", "description": "", "directives": [ "default" ], "properties": [ { "name": "project", "value": "cos-cloud" }, { "name": "family", "value": "cos-85-lts" } ], "dependencies": [ { "constraint": { "name": "configures", "title": "configures", "description": "", "min": 0, "max": 1, "match": null, "resourceType": "tosca.nodes.Root", "visibility": "visible" }, "name": "configures", "__typename": "Requirement" } ], "visibility": "hidden", "__typename": "DefaultTemplate", "computedProperties": [ ] } }, "ResourceTemplate": { "the_app": { "name": "the_app", "type": "GhostCMS", "title": "the_app", "description": "", "directives": [ ], "properties": [ { "name": "subdomain", "value": "l6703j9r1lcv" }, { "name": "email", "value": "admin@mailu.untrusted.me" } ], "dependencies": [ { "constraint": { "name": "container", "title": "container", "description": "", "visibility": "hidden", "min": 1, "max": 1, "match": "container_service", "resourceType": "unfurl.nodes.ContainerService" }, "name": "container", "__typename": "Requirement", "match": "container_service" }, { "constraint": { "name": "mail", "title": "Mail Server", "description": "Mail server to use for user registration and notifications", "min": 1, "max": 1, "match": null, "resourceType": "SMTPServer", "visibility": "visible" }, "name": "mail", "__typename": "Requirement", "completionStatus": "connected", "valid": true, "match": "__mail-server" } ], "__typename": "ResourceTemplate", "computedProperties": [ ] }, "container_service": { "name": "container_service", "type": "unfurl.nodes.ContainerService", "title": "container_service", "description": "", "directives": [ ], "properties": [ { "name": "container", "value": { "image": "ghost", "ports": [ "2368:2368" ], "volumes": [ "/var/app/ghost:/var/lib/ghost/content" ], "environment": { "eval": { "to_env": { "url": "https://{{ SELF.host }}", "database__client": "sqlite3", "database__connection__filename": "content/data/ghost.db", "database__useNullAsDefault": true, "database__debug": true, "mail__transport": "SMTP", "mail__from": { "eval": ".configured_by::email" }, "mail__options__host": { "eval": ".configured_by::.targets::mail::host" }, "mail__options__port": 587, "mail__options__auth__user": { "eval": ".configured_by::.targets::mail::user_name" }, "mail__options__auth__pass": { "eval": ".configured_by::.targets::mail::password" } } } } } } ], "dependencies": [ { "constraint": { "name": "host", "title": "host", "description": "", "min": 0, "max": 1, "match": null, "resourceType": "unfurl.nodes.DockerHost", "visibility": "hidden" }, "name": "host", "__typename": "Requirement", "match": "dockerhost" } ], "__typename": "ResourceTemplate", "computedProperties": [ ] }, "dockerhost": { "name": "dockerhost", "type": "unfurl.nodes.TraefikDockerComputeHost", "title": "dockerhost", "description": "", "directives": [ ], "properties": [ ], "dependencies": [ { "constraint": { "name": "dns", "title": "DNS", "description": "DNS provider for domain name configuration", "min": 1, "max": 1, "match": null, "resourceType": "unfurl.nodes.DNSZone", "visibility": "visible" }, "name": "dns", "__typename": "Requirement", "completionStatus": "connected", "valid": true, "match": "__route53dnszone" }, { "constraint": { "name": "host", "title": "Compute", "description": "A compute instance with at least 1000MB RAM", "min": 1, "max": 1, "match": null, "resourceType": "unfurl.nodes.Compute", "node_filter": { "properties": [ { "user_data": { "eval": ".configured_by::user_data" } }, { "portspec": { "eval": ".configured_by::portspec" } } ] }, "visibility": "visible" }, "name": "host", "__typename": "Requirement", "completionStatus": "created", "valid": true, "match": "compute" } ], "computedProperties": [ ], "__typename": "ResourceTemplate" }, "__route53dnszone": { "name": "__route53dnszone", "type": "Route53DNSZone", "title": "Route53DNSZone", "__typename": "ResourceTemplate", "properties": [ { "name": "access_key_id", "value": "AKIAVISQV7JAHDNJVS4B" }, { "name": "secret_access_key", "value": { "get_env": "route53dnszone__secret_access_key" } }, { "name": "name", "value": "opencloudservices.net" }, { "name": "testing", "value": true } ], "dependencies": [ ] }, "compute": { "name": "compute", "type": "unfurl.nodes.EC2Compute", "title": "Compute", "__typename": "ResourceTemplate", "properties": [ { "name": "num_cpus", "value": 1 }, { "name": "mem_size", "value": 2048 }, { "name": "disk_size", "value": 32 } ], "dependencies": [ ] }, "__mail-server": { "name": "__mail-server", "type": "GenericSMTPServer", "title": "Mail Server", "__typename": "ResourceTemplate", "properties": [ { "name": "host", "value": "mailu.untrusted.me" }, { "name": "user_name", "value": "admin@mailu.untrusted.me" }, { "name": "password", "value": { "get_env": "mail_server__password" } }, { "name": "protocol", "value": "tls" } ], "dependencies": [ ] } } }
`)

import {transformEnvironmentVariables, environmentVariableDependencies} from './deployment-template'

test('lists environment variable dependencies', () => {
    const deploymentObj = DeploymentObject1()
    expect(environmentVariableDependencies(deploymentObj)).toHaveLength(2)
    expect(environmentVariableDependencies(deploymentObj)).toContain('route53dnszone__secret_access_key')
    expect(environmentVariableDependencies(deploymentObj)).toContain('mail_server__password')
})

test('prefix environment variables', () => {
    const deploymentObj = DeploymentObject1()

    transformEnvironmentVariables(deploymentObj, null, 'foo')
    expect(environmentVariableDependencies(deploymentObj)).toHaveLength(2)
    expect(environmentVariableDependencies(deploymentObj)).toContain('foo__route53dnszone__secret_access_key')
    expect(environmentVariableDependencies(deploymentObj)).toContain('foo__mail_server__password')

})

const ResourceTemplate1 = () => JSON.parse('{"name":"primary_provider","type":"ConnectsTo.DigitalOceanEnvironment","__typename":"ResourceTemplate","dependencies":[],"properties":[{"name":"DIGITALOCEAN_TOKEN","value":{"get_env":"primary_provider__DIGITALOCEAN_TOKEN"}}],"computedProperties":[]}')

test('list environment variable dependencies in a resource template', () => {
    const resourceTemplate = ResourceTemplate1()
    expect(environmentVariableDependencies(resourceTemplate)).toHaveLength(1)
})
