export function generateIssueLink(projectPath, {title, description, context}) {
    const _context = {
        ...context,
        'Referring URL': window.location.pathname + window.location.search + window.location.hash,
    }
    const result = [`/${projectPath}/-/issues/new?`]

    result.push(encodeURIComponent('issue[description]'))
    result.push('=')
    if(description) {
        result.push(encodeURIComponent(description))
        result.push(encodeURIComponent('\n\n\n\n'))
        result.push(encodeURIComponent('```\n--- Debug info ---\n\n'))
    } else {
        result.push('```')
    }
    Object.entries(_context).forEach(([key, value]) => result.push(encodeURIComponent(`${key}: ${value}\n`)))
    result.push('```')
    

    if(title) {
        result.push('&')
        result.push(encodeURIComponent('issue[title]'))
        result.push('=')
        result.push(encodeURIComponent(title))
    }

    return result.join('')
}
