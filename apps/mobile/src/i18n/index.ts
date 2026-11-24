/** Mobile i18n (see README.md in this folder). Screens import from here: `import { useLanguage } from '../i18n';`. */
export type { MobileI18nKey } from './dictionaries/ru';
export { LanguageProvider, useLanguage, type LanguageContextValue } from './LanguageProvider';
export { LanguageSwitcher } from './LanguageSwitcher';
export { DEFAULT_LOCALE, LOCALES, LOCALE_HEADER, isLocale, type Locale } from './locale';
export { pluralForm, translatePlural, type PluralForm, type PluralKey } from './plural';
export { createTranslate, translate, type Translate, type TranslateParams } from './translate';
