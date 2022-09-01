export function cloneAlreadyDeployed({
    protocol, username, token, server, projectPath, projectId, environmentName, deployPath
}) {
    return (
`unfurl clone '${protocol}//${username}:${token}@${server}/${projectPath}#:${deployPath}' \\
    --var UNFURL_CLOUD_VARS_URL \\
    '${protocol}//${server}/api/v4/projects/${projectId}/variables?filter\${ENVIRONMENT:*}&private_token=${token}' \\
    --use-environment ${environmentName}`
    )
}

/*
 * unfurl clone https://<username>:<token>@<unfurl.server>/<project_path> --existing --overwrite --var UNFURL_CLOUD_VARS_URL 'https://<unfurl.server>/api/v4/projects/{project_id}/variables?filter=${ENVIRONMENT:*}&private_token=<token>' --mono --use-environment <environment> --use-deployment-blueprint <deployment> --skeleton dashboard <BLUEPRINT_PROJECT_URL> <DEPLOY_PATH>
 */

export function cloneForDraft({
    protocol, username, token, server, projectPath, projectId, environmentName, deploymentName, deployPath, blueprintUrl, blueprint
}) {
    return (
`unfurl clone '${protocol}//${username}:${token}@${server}/${projectPath}' \\
    --existing --overwrite --var UNFURL_CLOUD_VARS_URL \\
    '${protocol}//${server}/api/v4/projects/${projectId}/variables?filter=\${ENVIRONMENT:*}&private_token=${token}' \\
    --mono --use-environment ${environmentName} --use-deployment-blueprint ${blueprint} --skeleton dashboard \\
    ${blueprintUrl} ${deployPath}`
    )
}
