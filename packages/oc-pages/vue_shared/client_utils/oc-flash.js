import { createAlert as glCreateFlash, VARIANT_DANGER, VARIANT_SUCCESS, VARIANT_WARNING, VARIANT_INFO} from '~/alert';
import {generateGitLabIssueSync} from './gitlab-issues'

export function hideFlash() {} // todo

let lastOCFlash

export const FLASH_TYPES = {
    ALERT: VARIANT_DANGER,
    SUCCESS: VARIANT_SUCCESS,
    WARNING: VARIANT_WARNING,
    NOTICE: VARIANT_INFO
}

export function hideLastFlash() {
    if(lastOCFlash) {
        hideFlash(lastOCFlash)
    }
}

export function createFlash(options) {
    let message = options.message || ''
    let type = options.type
    if(options.issue) {
        if(!type) {type = FLASH_TYPES.ALERT}
        //message = `${message}<div>${options.issue}</div>`
    }
    const result = glCreateFlash({...options, message, variant: type}).$el
    if(options.linkTo && options.linkText) {
        window.requestAnimationFrame(() => {
            const flashText = result.$el
            const link = document.createElement('A')
            const linkContainer = document.createElement('DIV')
            link.textContent = options.linkText
            link.href = options.linkTo
            link.target = '_blank'
            linkContainer.appendChild(link)
            flashText.appendChild(linkContainer)
        })
    } else if(options.issue || type == FLASH_TYPES.ALERT) {
        window.requestAnimationFrame(async () => {
            const flashText = result.querySelector('.gl-alert-content')
            const issueContext = document.createElement('SPAN')
            const issueContainer = document.createElement('DIV')
            const createIssueLink = document.createElement('A')

            issueContext.textContent = options.issue

            createIssueLink.href = await generateGitLabIssueSync(options.projectPath, {confidential: options.confidential, title: options.issue, description: message, context: options.issueContext, serviceDesk: options.serviceDesk})
            createIssueLink.target = '_blank'
            createIssueLink.textContent = options.issue? 'Click to create an issue: ': 'Click to create an issue.'
            createIssueLink.appendChild(issueContext)

            issueContainer.appendChild(createIssueLink)

            flashText.appendChild(issueContainer)
        })
    }
    lastOCFlash = result
    return result
}

export default createFlash
