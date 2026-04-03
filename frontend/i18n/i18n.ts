import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import is from './is.json';

const savedLang = localStorage.getItem('utanvega-lang') || 'is';

i18n.use(initReactI18next).init({
    resources: {
        is: { translation: is },
        en: { translation: en },
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
