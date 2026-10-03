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

/**
 * Initial UI language for `hostname` — `savedLang` (the stored
 * `utanvega-lang` preference, if any) always wins on return visits; only a
 * first-time visitor with no saved preference, or an invalid/unsupported one,
 * falls through to the host-based default (360runs.com → en, hlaupadagskra.is
 * → is). Exported so it's unit-testable independently of the module-load call
 * below, mirroring brandNameForHostname's extraction.
 */
export function initialLangForHostname(hostname: string, savedLang: string | null): SupportedLang {
    return savedLang && isSupportedLang(savedLang) ? savedLang : localeForHostname(hostname);
}

const initialLang = initialLangForHostname(window.location.hostname, localStorage.getItem('utanvega-lang'));

/**
 * Brand name for `hostname` — "360Runs" on the English production host
 * (360runs.com/www., see HOST_LOCALES in _site.ts), the Icelandic brand
 * everywhere else — hlaupadagskra.is, previews, localhost. Exported so it's
 * unit-testable independently of the module-load call below, mirroring
 * usePageTitle.ts's siteForHostname.
 */
export function brandNameForHostname(hostname: string): string {
    return BRAND_NAME[localeForHostname(hostname)];
}

// `{{brandName}}` is host-based, not language-based — same signal every other
// BRAND_NAME consumer uses (Layout.tsx's header, FooterStatus.tsx's copyright,
// usePageTitle.ts's tab title, and the server-side og.ts/og-image.ts/
// manifest.ts), so a visitor who manually toggles the UI language still sees
// one consistent brand, not a mix of the two. The host doesn't change during
// a page's lifetime, so this is computed once, not re-derived on language
// change.
const brandName = brandNameForHostname(window.location.hostname);

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
