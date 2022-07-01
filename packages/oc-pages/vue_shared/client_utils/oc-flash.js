import glCreateFlash, { FLASH_TYPES, hideFlash } from '~/flash';
export { hideFlash, FLASH_TYPES } from '~/flash'
import {generateIssueLink} from './issues'

let lastOCFlash

export function hideLastFlash() {
    if(lastOCFlash) {
        hideFlash(lastOCFlash)
    }
}

export default function createFlash(options) {
    let message = options.message || ''
    let type = options.type
    if(options.issue) {
        if(!type) {type = FLASH_TYPES.ALERT}
        //message = `${message}<div>${options.issue}</div>`
    }
    const result = glCreateFlash({...options, message, type})
    if(options.projectPath && (options.issue || type == FLASH_TYPES.ALERT)) {
        window.requestAnimationFrame(async () => {
            const flashText = result.querySelector('.flash-container .flash-text')
            const issueContext = document.createElement('SPAN')
            const issueContainer = document.createElement('DIV')
            const createIssueLink = document.createElement('A')

            issueContext.textContent = options.issue

            createIssueLink.href = await generateIssueLink(options.projectPath, {title: options.issue, description: message, context: options.issueContext})
            createIssueLink.textContent = options.issue? 'Click to create an issue: ': 'Click to create an issue.'
            createIssueLink.appendChild(issueContext)

            issueContainer.appendChild(createIssueLink)

            flashText.appendChild(issueContainer)
        })
    } else if(options.linkTo && options.linkText) {
        window.requestAnimationFrame(() => {
            const flashText = result.querySelector('.flash-container .flash-text')
            const link = document.createElement('A')
            const linkContainer = document.createElement('DIV')
            link.textContent = options.linkText
            link.href = options.linkTo
            linkContainer.appendChild(link)
            flashText.appendChild(linkContainer)
        })
    }
    lastOCFlash = result
    return result
}
