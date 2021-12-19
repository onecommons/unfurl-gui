import Jed from 'jed';

const SPLIT_REGEX = /\s*[\r\n]+\s*/;

/**
 *
 * strips newlines from strings and replaces them with a single space
 *
 * @example
 *
 * ensureSingleLine('foo  \n  bar') === 'foo bar'
 *
 * @param {String} str
 * @returns {String}
 */
function ensureSingleLine(str) {
  // This guard makes the function significantly faster
  if (str.includes('\n') || str.includes('\r')) {
    return str
      .split(SPLIT_REGEX)
      .filter((s) => s !== '')
      .join(' ');
  }
  return str;
};

const GITLAB_FALLBACK_LANGUAGE = 'en';

const languageCode = () =>
  document.querySelector('html').getAttribute('lang') || GITLAB_FALLBACK_LANGUAGE;
const locale = new Jed(window.translations || {});
delete window.translations;

/**
  Translates `text`
  @param text The text to be translated
  @returns {String} The translated text
*/
const gettext = (text) => locale.gettext(ensureSingleLine(text));

export { languageCode };
export { gettext as __ };
export default locale;
