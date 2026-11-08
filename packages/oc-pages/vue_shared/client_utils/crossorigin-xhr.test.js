import {XhrIFrame} from './crossorigin-xhr'

// Plays the jail page: answers each 'xhr' event the iframe receives by
// dispatching the reply on the parent document under the event's id. The real
// page answers after a network round trip, so this does too: doXhr only starts
// listening once its own dispatch returns.
function answerWith(frame, status, payload) {
    const requests = []
    frame.element.contentWindow.addEventListener('xhr', ({detail}) => {
        requests.push(detail)
        setTimeout(() => document.dispatchEvent(new CustomEvent(detail.eventId, {detail: {status, payload}})))
    })
    return requests
}

afterEach(() => document.body.replaceChildren())

describe('XhrIFrame', () => {
    it('mounts a hidden iframe on the jail url', () => {
        const frame = new XhrIFrame()
        expect(frame.element.parentNode).toBe(document.body)
        expect(frame.element.className).toBe('gl-hidden')
        expect(frame.element.src).toContain(`?${frame.id}`)
    })

    it('forwards the request and resolves with the reply', async () => {
        const frame = new XhrIFrame()
        const requests = answerWith(frame, 200, {ok: true})

        await expect(frame.doXhr('post', '/api/x', {a: 1}, {'X-Test': 'y'}))
            .resolves.toEqual({data: {ok: true}, status: 200})
        expect(requests).toEqual([expect.objectContaining({
            method: 'POST', url: '/api/x', body: '{"a":1}', headers: {'X-Test': 'y'},
        })])
    })

    it('rejects an error status with the response attached', async () => {
        const frame = new XhrIFrame()
        answerWith(frame, 500, {message: 'boom'})

        const e = await frame.doXhr('get', '/api/x').catch(e => e)
        expect(e.message).toBe('500 error')
        expect(e.response).toEqual({data: {message: 'boom'}, status: 500})
    })

    it('rejects a transport failure with its message', async () => {
        const frame = new XhrIFrame()
        answerWith(frame, -1, {error: 'Network Error'})
        await expect(frame.doXhr('get', '/api/x')).rejects.toThrow('Network Error')
    })

    describe('with rejectErrorCode off', () => {
        it('resolves an error status', async () => {
            const frame = new XhrIFrame({rejectErrorCode: false})
            answerWith(frame, 500, {message: 'boom'})
            await expect(frame.doXhr('get', '/api/x')).resolves.toEqual({data: {message: 'boom'}, status: 500})
        })

        it('still rejects a transport failure', async () => {
            const frame = new XhrIFrame({rejectErrorCode: false})
            answerWith(frame, -1, {error: 'Network Error'})
            await expect(frame.doXhr('get', '/api/x')).rejects.toThrow('Network Error')
        })
    })

    it('stops listening once answered', async () => {
        const frame = new XhrIFrame()
        let eventId
        frame.element.contentWindow.addEventListener('xhr', ({detail}) => { eventId = detail.eventId })
        const remove = jest.spyOn(document, 'removeEventListener')

        const reply = frame.doXhr('get', '/api/x')
        document.dispatchEvent(new CustomEvent(eventId, {detail: {status: 200, payload: null}}))
        await reply

        expect(remove).toHaveBeenCalledWith(eventId, expect.any(Function))
        remove.mockRestore()
    })
})
