import {XHR_JAIL_URL} from '../storage-keys';

export interface XhrResponse<T = any> {
    data: T
    status: number
}

// What the jail page dispatches back; status -1 is a transport failure.
interface XhrReply {
    status: number
    payload: any
}

type XhrError = Error & {response?: XhrResponse}

function genUid() {
    return Math.random().toString(36).slice(-6)
}

export class XhrIFrame {
    rejectErrorCode = true
    id: string
    element: HTMLIFrameElement
    ready: Promise<Event>

    constructor(options?: {rejectErrorCode?: boolean}) {
        Object.assign(this, options || {})
        const id = this.id = genUid()
        const element = this.element = document.createElement('iframe')
        element.className = 'gl-hidden'
        element.src = `${XHR_JAIL_URL}?${id}`
        document.body.appendChild(element)
        this.ready = new Promise(
            resolve => this.element.contentWindow!.addEventListener('DOMContentLoaded', resolve)
        )
    }

    dispatchEvent(event: Event) {
        this.element.contentWindow!.dispatchEvent(event)
    }

    async doXhr(_method: string, url: string, body?: unknown, headers?: Record<string, string>): Promise<XhrResponse> {
        const method = _method.toUpperCase()
        const eventId = genUid()

        const event = new CustomEvent('xhr', {detail: {eventId, method, url, body: JSON.stringify(body), headers: headers || {}}})
        let resolve!: (response: XhrResponse) => void, reject!: (e: unknown) => void
        const p = new Promise<XhrResponse>((_resolve, _reject) => { resolve = _resolve; reject = _reject; })

        try {
            this.dispatchEvent(event)
            const handler = (({detail}: CustomEvent<XhrReply>) => {
                if(this.rejectErrorCode) {
                    if(detail.status >= 200 && detail.status <= 400){
                        resolve({
                            data: detail.payload,
                            status: detail.status
                        })
                    } else {
                        const e: XhrError = new Error(
                            detail.status == -1?
                                detail.payload.error: `${detail.status} error`
                        )
                        e.response = {
                            data: detail.payload,
                            status: detail.status
                        }

                        reject(e)
                    }
                } else if(detail.status == -1) {
                    reject(new Error(detail.payload.error))
                } else {
                    resolve({
                        data: detail.payload,
                        status: detail.status
                    })
                }
                document.removeEventListener(eventId, handler)
            }) as EventListener
            document.addEventListener(eventId, handler)
        } catch(e) {
            console.error(e)
            reject(e)
        }

        return p
    }
}
