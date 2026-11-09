// The standalone build resolves an svg import to a URL; the fork's loader
// inlines its markup. Either way the module's default export is a string.
declare module '*.svg' {
  const src: string;
  export default src;
}

// raster images resolve to a URL in both builds
declare module '*.png' {
  const src: string;
  export default src;
}

// ?inline: the svg's markup, in both builds
declare module '*.svg?inline' {
  const markup: string;
  export default markup;
}

// imported for its side effect
declare module '*.css'
