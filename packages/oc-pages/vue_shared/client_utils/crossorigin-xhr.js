import {XHR_JAIL_URL} from '../storage-keys';

function genUid() {
    return Math.random().toString(36).slice(-6)
}

export class XhrIFrame {
    constructor(options) {
        Object.assign(this, {
            rejectErrorCode: true
        }, options || {})
        const id = this.id = genUid()
        const element = this.element = document.createElement('IFRAME')
        element.className = 'd-none'
        element.src = `${XHR_JAIL_URL}?${id}`
        document.body.appendChild(element)
    }

    dispatchEvent(event) {
        this.element.contentWindow.dispatchEvent(event)
    }

    async doXhr(_method, url, body, headers) {
        const method = _method.toUpperCase()
        const eventId = genUid()

        const event = new CustomEvent('xhr', {detail: {eventId, method, url, body: JSON.stringify(body), headers: headers || {}}})
        let resolve, reject
        const p = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject; })

        try {
            this.dispatchEvent(event)
            const handler = ({detail}) => {
                if(this.rejectErrorCode) {
                    if(detail.status >= 200 && detail.status <= 400){
                        resolve(detail.payload)
                    } else { reject(detail.payload) }
                } else {
                    resolve(detail)
                }
                document.removeEventListener(eventId, handler)
            }
            document.addEventListener(eventId, handler)
        } catch(e) {
            console.error(e)
            reject(e)
        }

        return p
    }
}
