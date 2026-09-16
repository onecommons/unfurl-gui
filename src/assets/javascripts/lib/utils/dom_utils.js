// Copied from gitlab (app/assets/javascripts/lib/utils/dom_utils.js). Only the
// helpers oc-pages reaches for; the fork build resolves `~` to the real file.
export const getContentWrapperHeight = (contentWrapperClass = '.content-wrapper') => {
  const wrapperEl = document.querySelector(contentWrapperClass);
  return wrapperEl ? `${wrapperEl.offsetTop}px` : '';
};
