import { parse as markedParse } from 'marked'
import DOMPurify from 'dompurify'

export function parseMarkdown(input) {
    // the gitlab marked dependency is so old that I don't want to mess with renderer or tokens
    if(! input) { return '' }
    try {
        let result = markedParse(input)
        result = result.replace(/<a /i, '<a target="_blank" rel="noopener noreferrer" ')
        return DOMPurify.sanitize(result, { USE_PROFILES: { html: true }, ALLOWED_TAGS: ['b', 'i', 'code', 'pre', 'a', 'p'], ADD_ATTR: ['target']})
    } catch(e) {
        console.error(e)
        return ''
    }
}
