export function unfurl_cloud_vars_url({
  protocol, token, server, projectId
}) {
  return `${protocol}//${server}/api/v4/projects/${projectId}/variables?per_page=1000&private_token=${token}`
}

export function cloneProject({
  protocol, username, token, server, projectPath, projectId
}) {
  const vars_url = unfurl_cloud_vars_url({ protocol, token, server, projectId });
  const credentials = (username && token)?
    `${username}:${token}@`: ''
  const varsSection = token? ` --var UNFURL_CLOUD_VARS_URL '${vars_url}'`: ''
  return (
    `unfurl clone '${protocol}//${credentials}${server}/${projectPath}'${varsSection}`
  )
}

export function cloneBlueprint({
  projectName, environmentName, deploymentName, deployPath, blueprintUrl
}) {
  return (
    `cd ${projectName}; unfurl clone --existing --overwrite --mono --use-environment ${environmentName} --use-deployment-blueprint ${deploymentName} --skeleton dashboard ${blueprintUrl} ${deployPath}`
  )
}
