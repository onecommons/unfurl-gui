import axios from '~/lib/utils/axios_utils'
import {countComments, lookupNumberOfComments} from './comments'

jest.mock('~/lib/utils/axios_utils', () => ({
    __esModule: true,
    default: {get: jest.fn()},
}))

const discussions = [
    {notes: [{type: null}, {type: 'DiscussionNote'}]},
    // system notes (label changes etc.) are not comments
    {notes: [{type: 'SystemNote'}]},
    {notes: []},
]

describe('countComments', () => {
    it('counts discussion notes and untyped notes only', () => {
        expect(countComments(discussions)).toBe(2)
    })

    it('is 0 with no discussions', () => {
        expect(countComments([])).toBe(0)
    })
})

describe('lookupNumberOfComments', () => {
    afterEach(() => axios.get.mockReset())

    it('fetches the issue discussions and counts them', async () => {
        axios.get.mockResolvedValue({data: discussions})
        await expect(lookupNumberOfComments('/group/proj/-/issues/3')).resolves.toBe(2)
        expect(axios.get).toHaveBeenCalledWith('/group/proj/-/issues/3/discussions.json')
    })
})
