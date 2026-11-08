// @ts-check
import {isReactive, isReadonly, markRaw} from 'vue'

/** @param {number} period milliseconds */
export function sleep(period) {
    return new Promise(resolve => setTimeout(resolve, period))
}

/*
 * Vue 2 walked everything it stored and made each property reactive, so
 * freezing was how this code kept large API payloads out of that walk. Vue 3
 * proxies lazily and needs no such hint -- and freezing is now unsafe:
 * Object.freeze on a reactive proxy freezes the object behind it, after which
 * the proxy's get trap is required to hand back exactly what the target holds
 * and cannot, because it has to wrap nested objects. The browser throws
 * "proxy did not return its actual value" on the next read.
 *
 * So freeze only what is not already reactive, and mark it first so Vue never
 * wraps it later either.
 */
/**
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export const freeze = obj => {
  if (!obj || typeof obj !== 'object' || isReactive(obj) || isReadonly(obj)) return obj;
  return Object.freeze(markRaw(obj));
};

/**
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export const deepFreeze = obj => {
  if (!obj || typeof obj !== 'object' || isReactive(obj) || isReadonly(obj)) return obj;
  const record = /** @type {Record<string, unknown>} */ (obj);
  Object.keys(record).forEach(prop => {
    if (record[prop] && typeof record[prop] === 'object') deepFreeze(record[prop]);
  });
  return Object.freeze(markRaw(obj));
};
