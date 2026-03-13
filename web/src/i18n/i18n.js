/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCNTranslation from './locales/zh-CN.json';
const localeLoaders = {
  en: () => import('./locales/en.json'),
  fr: () => import('./locales/fr.json'),
  'zh-TW': () => import('./locales/zh-TW.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  vi: () => import('./locales/vi.json'),
};

const loadedLanguages = new Set(['zh-CN']);

function normalizeLanguage(language = 'zh-CN') {
  if (!language) return 'zh-CN';

  const lower = language.toLowerCase();
  if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk')) {
    return 'zh-TW';
  }
  if (lower.startsWith('zh')) {
    return 'zh-CN';
  }

  const baseLanguage = lower.split('-')[0];
  return localeLoaders[baseLanguage] ? baseLanguage : 'zh-CN';
}

async function ensureLocaleLoaded(language) {
  const normalizedLanguage = normalizeLanguage(language);

  if (loadedLanguages.has(normalizedLanguage)) {
    return normalizedLanguage;
  }

  const loader = localeLoaders[normalizedLanguage];
  if (!loader) {
    return 'zh-CN';
  }

  const module = await loader();
  i18n.addResourceBundle(
    normalizedLanguage,
    'translation',
    module.default ?? module,
    true,
    true,
  );
  loadedLanguages.add(normalizedLanguage);

  return normalizedLanguage;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    load: 'currentOnly',
    supportedLngs: Object.keys(localeLoaders),
    nonExplicitSupportedLngs: true,
    resources: {
      'zh-CN': {
        translation: zhCNTranslation,
      },
    },
    fallbackLng: 'zh-CN',
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
    },
  });

ensureLocaleLoaded(i18n.resolvedLanguage || i18n.language).then(
  (normalizedLanguage) => {
    const currentLanguage = i18n.resolvedLanguage || i18n.language;
    if (normalizedLanguage !== currentLanguage) {
      i18n.changeLanguage(normalizedLanguage);
    }
  },
);

i18n.on('languageChanged', (language) => {
  ensureLocaleLoaded(language).then((normalizedLanguage) => {
    if (normalizedLanguage !== language) {
      i18n.changeLanguage(normalizedLanguage);
    }
  });
});

export default i18n;
