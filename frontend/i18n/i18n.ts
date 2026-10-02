import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { BRAND_NAME, localeForHostname, type Locale } from '../api/_site';

type SupportedLang = Locale;

const loaders: Record<SupportedLang, () => Promise<{ default: Record<string, unknown> }>> = {
    is: () => import('./is.json'),
    en: () => import('./en.json'),
};

function isSupportedLang(lang: string): lang is SupportedLang {
    return lang === 'is' || lang === 'en';
}

// An existing stored preference always wins on return visits; only a
// first-time visitor with no `utanvega-lang` key falls through to the
// host-based default (360runs.com → en, hlaupadagskra.is → is).
const savedLang = localStorage.getItem('utanvega-lang');
const initialLang: SupportedLang =
    savedLang && isSupportedLang(savedLang) ? savedLang : localeForHostname(window.location.hostname);

// `{{brandName}}` is host-based, not language-based — same signal every other
// BRAND_NAME consumer uses (Layout.tsx's header, FooterStatus.tsx's copyright,
// usePageTitle.ts's tab title, and the server-side og.ts/og-image.ts/
// manifest.ts), so a visitor who manually toggles the UI language still sees
// one consistent brand, not a mix of the two. The host doesn't change during
// a page's lifetime, so this is computed once, not re-derived on language
// change.
const hostLocale = localeForHostname(window.location.hostname);
const brandName = BRAND_NAME[hostLocale];

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
            defaultVariables: { brandName },
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
