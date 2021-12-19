import fs from 'fs'
import path from 'path'

export default [
    fs.readFileSync(path.resolve(__dirname, './schema.graphql'), { encoding: 'utf8' }),
    fs.readFileSync(path.resolve(__dirname, './gitlab_schema.graphql'), { encoding: 'utf8' })
]
