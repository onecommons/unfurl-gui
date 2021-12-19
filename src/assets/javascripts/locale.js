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

/**
  Translate context based text
  Either pass in the context translation like `Context|Text to translate`
  or allow for dynamic text by doing passing in the context first & then the text to translate

  @param keyOrContext Can be either the key to translate including the context
                      (eg. 'Context|Text') or just the context for the translation
                      (eg. 'Context')
  @param key Is the dynamic variable you want to be translated
  @returns {String} Translated context based text
*/
const pgettext = (keyOrContext, key) => {
  const normalizedKey = ensureSingleLine(key ? `${keyOrContext}|${key}` : keyOrContext);
  const translated = gettext(normalizedKey).split('|');

  return translated[translated.length - 1];
};

export { languageCode };
export { gettext as __ };
// export { ngettext as n__ };
export { pgettext as s__ };
// export { sprintf };  
export default locale;
