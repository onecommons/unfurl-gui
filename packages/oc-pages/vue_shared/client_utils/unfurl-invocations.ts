interface Server {
  protocol: string
  server: string
  projectId: string | number
  token?: string
}

export function unfurl_cloud_vars_url({
  protocol, token, server, projectId
}: Server) {
  return `${protocol}//${server}/api/v4/projects/${projectId}/variables?per_page=1000&private_token=${token}`
}

export function cloneProject({
  protocol, username, token, server, projectPath, projectId
}: Server & {username?: string, projectPath: string}) {
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
}: {
  projectName: string
  environmentName: string
  deploymentName: string
  deployPath: string
  blueprintUrl: string
}) {
  return (
    `cd ${projectName}; unfurl clone --existing --overwrite --mono --use-environment ${environmentName} --use-deployment-blueprint ${deploymentName} --skeleton dashboard ${blueprintUrl} ${deployPath}`
  )
}
