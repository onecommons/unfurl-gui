const tailwindDefaults = require('@gitlab/ui/tailwind.defaults');

/*
 * From @gitlab/ui 136 the gl-* utility classes are no longer shipped as built
 * CSS -- the consumer generates them from this preset. Without it every gl-*
 * utility in our templates silently does nothing.
 *
 * Mirrors config/tailwind.config.js in the fork, with our content globs.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [tailwindDefaults],
  darkMode: ['variant', ['&:where(.gl-dark *)']],
  content: [
    './src/**/*.{vue,js,html}',
    './public/*.html',
    './packages/oc-pages/**/*.{vue,js}',
    './node_modules/@gitlab/ui/src/**/*.{vue,js}',
  ],
};
