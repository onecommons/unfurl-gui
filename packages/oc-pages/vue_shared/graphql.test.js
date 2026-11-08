import {ApolloLink, execute, Observable} from '@apollo/client/core'
import gql from 'graphql-tag'
import {link} from './graphql'

// the query as it reaches the next link
function sent(query) {
    let forwarded
    const capture = new ApolloLink(operation => {
        forwarded = operation.query
        return Observable.of({data: {}})
    })
    return new Promise((resolve, reject) => {
        execute(link.concat(capture), {query}).subscribe({complete: () => resolve(forwarded), error: reject})
    })
}

const fragmentNames = query => query.definitions
    .filter(d => d.kind == 'FragmentDefinition')
    .map(d => d.name.value)
    .sort()

describe('the fragment pruning link', () => {
    it('drops fragments no operation uses', async () => {
        const query = await sent(gql`
            query Q { project { ...Used } }
            fragment Used on Project { id }
            fragment Unused on Project { name }
        `)
        expect(fragmentNames(query)).toEqual(['Used'])
        expect(query.definitions[0].kind).toBe('OperationDefinition')
    })

    it('keeps fragments reached through other fragments', async () => {
        const query = await sent(gql`
            query Q { project { ...Outer } }
            fragment Outer on Project { ...Inner }
            fragment Inner on Project { id }
        `)
        expect(fragmentNames(query)).toEqual(['Inner', 'Outer'])
    })

    it('drops a chain hanging off an unused fragment', async () => {
        const query = await sent(gql`
            query Q { project { id } }
            fragment Dead on Project { ...AlsoDead }
            fragment AlsoDead on Project { ...DeadToo }
            fragment DeadToo on Project { name }
        `)
        expect(fragmentNames(query)).toEqual([])
    })

    it('leaves a query without fragments alone', async () => {
        const query = gql`query Q { project { id } }`
        expect((await sent(query)).definitions).toEqual(query.definitions)
    })
})
