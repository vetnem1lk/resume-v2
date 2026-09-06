// Facts that do not change with the language: the canonical origin, the four CV
// files with their byte sizes (pinned by test/pdf.test.ts), the profile URLs.
export const ORIGIN = 'https://resume.cryzothic.tech';

export const CV_FILES = [
  { key: 'en', file: '/cv/Klimentev_Vladislav_CPP_Developer_EN.pdf', bytes: 70561 },
  { key: 'ru', file: '/cv/Klimentev_Vladislav_CPP_Developer_RU.pdf', bytes: 183686 },
  { key: 'en-ats', file: '/cv/Klimentev_Vladislav_CPP_Developer_EN_ATS.pdf', bytes: 78844 },
  { key: 'ru-ats', file: '/cv/Klimentev_Vladislav_CPP_Developer_RU_ATS.pdf', bytes: 93497 },
] as const;

export const PROFILES = {
  vk: 'https://vk.ru/vetnem1lk',
  telegram: 'https://t.me/cryzoth',
  github: 'https://github.com/vetnem1lk',
  email: 'mailto:klimentev.vlad@gmail.com',
  v1: 'https://me.cryzothic.tech',
} as const;
