export function cloneAlreadyDeployed({
    protocol, username, token, server, projectPath, projectId, environmentName, deployPath
}) {
  const vars_url = unfurl_cloud_vars_url({protocol, token, server, projectId});
  return (
`unfurl clone '${protocol}//${username}:${token}@${server}/${projectPath}#:${deployPath}' --var UNFURL_CLOUD_VARS_URL '${vars_url}' --use-environment ${environmentName}`
    )
}

export function unfurl_cloud_vars_url({
  protocol, token, server, projectId
}) {
  return `${protocol}//${server}/api/v4/projects/${projectId}/variables?per_page=1000&private_token=\${UNFURL_ACCESS_TOKEN:${token}}`
}

/*
 * unfurl clone https://<username>:<token>@<unfurl.server>/<project_path> --existing --overwrite --var UNFURL_CLOUD_VARS_URL 'https://<unfurl.server>/api/v4/projects/{project_id}/variables?filter=${ENVIRONMENT:*}&private_token=<token>' --mono --use-environment <environment> --use-deployment-blueprint <deployment> --skeleton dashboard <BLUEPRINT_PROJECT_URL> <DEPLOY_PATH>
 */

export function cloneForDraft({
    protocol, username, token, server, projectPath, projectId, environmentName, deploymentName, deployPath, blueprintUrl, blueprint
}) {
    const vars_url = unfurl_cloud_vars_url(protocol, token, server, projectId);
    return (
`unfurl clone '${protocol}//${username}:${token}@${server}/${projectPath}' 
    --existing --overwrite --var UNFURL_CLOUD_VARS_URL '${vars_url}' --mono --use-environment ${environmentName} --use-deployment-blueprint ${blueprint} --skeleton dashboard ${blueprintUrl} ${deployPath}`
    )
}
