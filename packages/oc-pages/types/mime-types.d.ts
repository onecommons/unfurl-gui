// The part of mime-types oc-pages uses; the package ships no types.
declare module 'mime-types' {
    export function lookup(path: string): string | false
}
