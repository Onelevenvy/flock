"use client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { LanguagesSupported } from "@/i18n/language";

const loadLangResources = (lang: string) => ({
  translation: {
    dashboard: require(`./${lang}/dashboard`).default,
    sidebar: require(`./${lang}/sidebar`).default,
    chat: require(`./${lang}/chat`).default,
    setting: require(`./${lang}/setting`).default,
    panestate: require(`./${lang}/panestate`).default,
    team: require(`./${lang}/team`).default,
  },
});

// Automatically generate the resources object
const resources = LanguagesSupported.reduce((acc: any, lang: string) => {
  acc[lang] = loadLangResources(lang);

  return acc;
}, {});

i18n.use(initReactI18next).init({
  lng: undefined,
  fallbackLng: "en-US",
  resources,
});

export const changeLanguage = i18n.changeLanguage;
export default i18n;
