// For tsconfig.json, which plain tsc runs: there a .vue import is just a
// component, so .ts code stays strict without pulling components into the
// strict program. tsconfig.components.json, run by vue-tsc, reads the real
// files and does not include this.
declare module '*.vue' {
  import type {DefineComponent} from 'vue'
  const component: DefineComponent<object, object, any>
  export default component
}
