export function projectPathToHomeRoute(projectPath) {
    const split = projectPath.split('/')
    if(split.length == 2 && split[1] == 'dashboard') {
        return `/home/${split[0]}`
    }
    return `/home/${projectPath}`
}
