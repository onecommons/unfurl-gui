import mitt from 'mitt'

/*
 * A general event bus.
 *
 * Was `new Vue()`, the Vue 2 idiom. Vue 3 removes the instance event emitter
 * ($on/$off/$emit) and `new Vue()` itself, so this is a plain emitter instead.
 * The $-prefixed names are kept so the importers are unchanged; only $on, $off
 * and $emit are used.
 */
const emitter = mitt()

export const bus = {
  $on: emitter.on,
  $off: emitter.off,
  $emit: emitter.emit,
  all: emitter.all
}
