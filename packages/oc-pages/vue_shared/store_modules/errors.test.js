import errors from './errors'

/*
 * The traceback panel is keyed on `context.details` starting with "Traceback"
 * and nothing else, so what a caller passes as `context` decides whether a
 * python stack renders in its own code-clipboard or as text inside a property
 * blob. Both the synchronous write path and a discarded write's event now pass
 * the server's body itself, which is what makes the two boxes read alike.
 */
describe('createError', () => {
    let state

    const create = payload => {
        errors.mutations.createError(state, payload)
        return state.errors.at(-1)
    }

    beforeEach(() => { state = {errors: [], errorsClearedTo: 0} })

    const body = {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Could not apply batch',
        details: 'Traceback (most recent call last):\n  KeyError: \'name\'',
    }

    it('lifts a traceback out of the server body', () => {
        expect(create({message: 'failed', context: body}).traceback).toBe(body.details)
    })

    // the shape the sync path used to pass: details one level too deep
    it('finds nothing when the body is nested a level down', () => {
        expect(create({message: 'failed', context: {method: 'update_environment', response: body}}))
            .not.toHaveProperty('traceback')
    })

    // a reserved-name refusal never had an exception to attach one to
    it('leaves the key off a body with no details', () => {
        expect(create({message: 'failed', context: {status: 400, code: 'BAD_REQUEST', message: 'no'}}))
            .not.toHaveProperty('traceback')
    })

    it('unwraps an Error, which has no body to read', () => {
        const err = create({message: 'failed', context: new Error('Network Error')})

        expect(err.context).toBe('Network Error')
        expect(err).not.toHaveProperty('traceback')
    })

    // extra keys ride along as their own rows; the sync path sends `request`
    it('keeps any other keys the caller passes', () => {
        expect(create({message: 'failed', context: body, request: {branch: 'main'}}).request)
            .toEqual({branch: 'main'})
    })

    it('defaults the severity to major', () => {
        expect(create({message: 'failed'}).severity).toBe('major')
    })
})
