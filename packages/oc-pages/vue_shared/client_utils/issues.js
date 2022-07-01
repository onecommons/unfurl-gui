import gql from 'graphql-tag'
import {fetchUserPublicEmail} from './user'
const BASE_URL = 'https://onecommons.zendesk.com/hc/requests/new?'
const BR = '<br>' // for gitlab use \n
const PRE_O = '<pre>' // for gitlab use ```
const PRE_C = '</pre>'

const EMAIL_PARAM = 'tf_anonymous_requester_email'
const DESCRIPTION_PARAM = 'tf_description'
const TITLE_PARAM = 'tf_subject'

export async function generateIssueLink(projectPath, {title, description, context}) {
    const _context = {
        ...context,
        'Dashboard Project': projectPath,
        'Referring URL': window.location.pathname + window.location.search + window.location.hash,
    }
    const email = await fetchUserPublicEmail()
    const result = [BASE_URL]

    result.push(encodeURIComponent(DESCRIPTION_PARAM))
    result.push('=')
    if(description) {
        result.push(encodeURIComponent(description))
        result.push(encodeURIComponent(BR + BR + BR))
        result.push(encodeURIComponent(PRE_O + '--- Debug info ---' + BR + BR))
    } else {
        result.push(PRE_O)
    }
    Object.entries(_context).forEach(([key, value]) => result.push(encodeURIComponent(`${key}: ${value}\n`)))
    result.push(PRE_C)
    

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
