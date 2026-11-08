const BASE_URL = window.gon.unfurl_gui? window.gon.gitlab_url: window.origin
const BR = '\n'
const PRE_O = '```'
const PRE_C = '```'

const DESCRIPTION_PARAM = 'issue[description]'
const TITLE_PARAM = 'issue[title]'
const CONFIDENTIAL_PARAM = 'issue[confidential]'

export function generateGitLabIssueSync(projectPath: string, {title, description, context, confidential, serviceDesk}: {
    title?: string
    description?: string
    context?: Record<string, unknown>
    confidential?: boolean
    // file on this project's service desk instead
    serviceDesk?: string
}) {
    const _context: Record<string, unknown> = {
        ...context,
        'Referring URL': window.location.href,
    }
    if(!_context['Dashboard Project']) delete _context['Dashboard Project']
    const result = [`${BASE_URL}/${serviceDesk || projectPath}/-/issues/new?`]

    result.push(encodeURIComponent(DESCRIPTION_PARAM))
    result.push('=')
    if(description) {
        result.push(encodeURIComponent(description))
        result.push(encodeURIComponent(BR + BR + BR))
        result.push(encodeURIComponent(PRE_O + BR + '--- Debug info ---' + BR + BR))
    } else {
        result.push(encodeURIComponent(PRE_O))
    }
    Object.entries(_context).forEach(([key, value]) => result.push(encodeURIComponent(`${key}: ${value}\n`)))
    result.push(encodeURIComponent(PRE_C))
    

    if(title) {
        result.push('&')
        result.push(encodeURIComponent(TITLE_PARAM))
        result.push('=')
        result.push(encodeURIComponent(title))
    }

    if(confidential) {
        result.push('&')
        result.push(encodeURIComponent(CONFIDENTIAL_PARAM))
        result.push('=')
        result.push('true')
    }

    return result.join('')
}
