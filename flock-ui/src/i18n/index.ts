import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhCommon from './locales/zh/common.json';
import zhSidebar from './locales/zh/sidebar.json';
import zhHeader from './locales/zh/header.json';
import zhSettings from './locales/zh/settings.json';
import zhSystemSettings from './locales/zh/systemSettings.json';
import zhHome from './locales/zh/home.json';
import zhPlaceholder from './locales/zh/placeholder.json';
import zhAssistant from './locales/zh/assistant.json';
import zhSkills from './locales/zh/skills.json';
import zhChat from './locales/zh/chat.json';
import zhSchedule from './locales/zh/schedule.json';
import zhWorkflow from './locales/zh/workflow.json';

import enCommon from './locales/en/common.json';
import enSidebar from './locales/en/sidebar.json';
import enHeader from './locales/en/header.json';
import enSettings from './locales/en/settings.json';
import enSystemSettings from './locales/en/systemSettings.json';
import enHome from './locales/en/home.json';
import enPlaceholder from './locales/en/placeholder.json';
import enAssistant from './locales/en/assistant.json';
import enSkills from './locales/en/skills.json';
import enChat from './locales/en/chat.json';
import enSchedule from './locales/en/schedule.json';
import enWorkflow from './locales/en/workflow.json';

const savedLang = localStorage.getItem('flock-lang') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: {
        translation: {
          common: zhCommon,
          sidebar: zhSidebar,
          header: zhHeader,
          settings: zhSettings,
          systemSettings: zhSystemSettings,
          home: zhHome,
          placeholder: zhPlaceholder,
          assistant: zhAssistant,
          skills: zhSkills,
          chat: zhChat,
          schedule: zhSchedule,
          workflow: zhWorkflow,
        },
      },
      en: {
        translation: {
          common: enCommon,
          sidebar: enSidebar,
          header: enHeader,
          settings: enSettings,
          systemSettings: enSystemSettings,
          home: enHome,
          placeholder: enPlaceholder,
          assistant: enAssistant,
          skills: enSkills,
          chat: enChat,
          schedule: enSchedule,
          workflow: enWorkflow,
        },
      },
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
