export function unfurl_cloud_vars_url({
  protocol, token, server, projectId
}) {
  return `${protocol}//${server}/api/v4/projects/${projectId}/variables?per_page=1000&private_token=\${UNFURL_PROJECT_TOKEN:${token}}`
}

export function cloneProject({
  protocol, username, token, server, projectPath, projectId
}) {
  const vars_url = unfurl_cloud_vars_url({ protocol, token, server, projectId });
  return (
    `unfurl clone '${protocol}//${username}:${token}@${server}/${projectPath}' --var UNFURL_CLOUD_VARS_URL '${vars_url}'`
  )
}

export function cloneBlueprint({
  projectName, environmentName, deploymentName, deployPath, blueprintUrl
}) {
  return (
    `cd ${projectName}; unfurl clone --existing --overwrite --mono --use-environment ${environmentName} --use-deployment-blueprint ${deploymentName} --skeleton dashboard ${blueprintUrl} ${deployPath}`
  )
}
