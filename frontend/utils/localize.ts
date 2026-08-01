import { useTranslation } from 'react-i18next';

/**
 * Returns the localized value — EN when language is 'en' and an EN value exists,
 * otherwise falls back to IS (or EN if IS is also absent).
 */
export function localize(
    is: string | null | undefined,
    en: string | null | undefined,
    lang: string
): string | null {
    if (lang === 'en' && en) return en;
    return is ?? en ?? null;
}

/** Hook variant — binds current language so callers don't need to thread `lang`. */
export function useLocalize() {
    const { i18n } = useTranslation();
    const lang = i18n.language;
    return (is: string | null | undefined, en: string | null | undefined): string | null =>
        localize(is, en, lang);
}
