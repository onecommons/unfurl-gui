// The standalone build resolves an svg import to a URL; the fork's loader
// inlines its markup. Either way the module's default export is a string.
declare module '*.svg' {
  const src: string;
  export default src;
}
