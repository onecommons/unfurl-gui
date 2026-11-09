// locale.js is plain JS; inferred from its parameters, s__ would demand two
// arguments, but a single 'Context|Text' key is the usual call.
export function __(text: string): string
export function n__(singular: string, plural: string, count: number): string
export function s__(keyOrContext: string, key?: string): string
export function sprintf(input: string, parameters?: Record<string, unknown>, escapeParameters?: boolean): string
export const languageCode: () => string
