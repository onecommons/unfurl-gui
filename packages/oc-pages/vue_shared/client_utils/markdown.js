import { parse as markedParse } from 'marked'
import DOMPurify from 'dompurify'

export function parseMarkdown(input) {
    // the gitlab marked dependency is so old that I don't want to mess with renderer or tokens
    if(! input) { return '' }
    try {
        let result = markedParse(input)
        result = result.replace(/<a /i, '<a target="_blank" rel="noopener noreferrer" ')
        // FORBID_TAGS is not ours to need -- the fork registers global DOMPurify
        // hooks (app/assets/javascripts/lib/dompurify.js) that read
        // `config.FORBID_TAGS.includes('style')` unguarded, so sanitizing
        // without it throws inside their hook and every description renders
        // empty. Standalone has no such hooks, which is why this is fork-only.
        return DOMPurify.sanitize(result, {
            USE_PROFILES: { html: true },
            ALLOWED_TAGS: ['b', 'i', 'code', 'pre', 'a', 'p'],
            ADD_ATTR: ['target'],
            FORBID_TAGS: [],
        })
    } catch(e) {
        console.error(e)
        return ''
    }
}
