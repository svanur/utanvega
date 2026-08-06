import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

type SupportedLang = 'is' | 'en';

const loaders: Record<SupportedLang, () => Promise<{ default: Record<string, unknown> }>> = {
    is: () => import('./is.json'),
    en: () => import('./en.json'),
};

function isSupportedLang(lang: string): lang is SupportedLang {
    return lang === 'is' || lang === 'en';
}

const savedLang = localStorage.getItem('utanvega-lang') || 'is';
const initialLang: SupportedLang = isSupportedLang(savedLang) ? savedLang : 'is';

async function loadLanguage(lang: SupportedLang) {
    if (i18n.hasResourceBundle(lang, 'translation')) return;
    const { default: resources } = await loaders[lang]();
    i18n.addResourceBundle(lang, 'translation', resources);
}

export const i18nReady = (async () => {
    const { default: resources } = await loaders[initialLang]();

    await i18n.use(initReactI18next).init({
        resources: { [initialLang]: { translation: resources } },
        lng: initialLang,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

    // Load the fallback language in the background so missing-key fallback
    // and later language switches don't have to wait on a fresh fetch.
    if (initialLang !== 'en') {
        void loadLanguage('en');
    }
})();

export async function changeLanguage(lang: string) {
    if (!isSupportedLang(lang)) return;
    await loadLanguage(lang);
    await i18n.changeLanguage(lang);
}

export default i18n;
