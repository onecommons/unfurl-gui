// marked 4.3 exports `parse` at runtime; @types/marked 4.3.2 only declares it on
// the `marked` namespace.
import { marked } from 'marked';

declare module 'marked' {
  export const parse: typeof marked.parse;
}
