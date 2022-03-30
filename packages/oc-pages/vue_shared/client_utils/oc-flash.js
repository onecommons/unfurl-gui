import glCreateFlash, { FLASH_TYPES } from '~/flash';
export { FLASH_TYPES } from '~/flash'
import {generateIssueLink} from './issues'

export default function createFlash(options) {
    let message = options.message || ''
    let type = options.type
    if(options.issue) {
        if(!type) {type = FLASH_TYPES.ALERT}
        //message = `${message}<div>${options.issue}</div>`
    }
    glCreateFlash({...options, message, type})
    if(options.projectPath && (options.issue || type == FLASH_TYPES.ALERT)) {
        window.requestAnimationFrame(() => {
            const flashText = document.querySelector('.flash-container .flash-text')
            const issueContext = document.createElement('SPAN')
            const issueContainer = document.createElement('DIV')
            const createIssueLink = document.createElement('A')

            issueContext.textContent = options.issue

            createIssueLink.href = generateIssueLink(options.projectPath, {title: options.issue, description: message, context: options.issueContext})
            createIssueLink.textContent = options.issue? 'Click to create an issue: ': 'Click to create an issue.'
            createIssueLink.appendChild(issueContext)

            issueContainer.appendChild(createIssueLink)

            flashText.appendChild(issueContainer)
        })
    }

}
