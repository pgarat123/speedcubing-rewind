import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

// Anglais par défaut, français si le navigateur est en français.
const lang = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: lang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
