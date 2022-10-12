const BASE_URL = `${window.origin}`
const BR = '\n'
const PRE_O = '```'
const PRE_C = '```'

//const EMAIL_PARAM = 'tf_anonymous_requester_email'
const DESCRIPTION_PARAM = 'issue[description]'
const TITLE_PARAM = 'issue[title]'

export function generateGitLabIssueSync(projectPath, {title, description, context, email}) {
    console.log({title, description})
    const _context = {
        ...context,
        'Referring URL': window.location.pathname + window.location.search + window.location.hash,
    }
    if(!_context['Dashboard Project']) delete _context['Dashboard Project']
    const result = [`${BASE_URL}/${projectPath}/-/issues/new?`]

    result.push(encodeURIComponent(DESCRIPTION_PARAM))
    result.push('=')
    if(description) {
        result.push(encodeURIComponent(description))
        result.push(encodeURIComponent(BR + BR + BR))
        result.push(encodeURIComponent(PRE_O + '--- Debug info ---' + BR + BR))
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

    if(email) {
        result.push('&')
        result.push(encodeURIComponent(EMAIL_PARAM))
        result.push('=')
        result.push(encodeURIComponent(email))
    }

    return result.join('')
}
