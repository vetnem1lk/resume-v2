// The shape of one language of the resume. Copy comes verbatim from the shipped CV;
// structure (separate fields) stands in for the CV's em-dash separators.
export type Lang = 'en' | 'ru';

export const SECTION_IDS = ['top', 'profile', 'projects', 'experience', 'skills', 'education', 'achievements', 'contact'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface Link { href: string; label: string }

export interface Project { name: string; tagline: string; bullets: string[]; tech?: string; link?: Link }

export interface Job {
  company: string;
  place: string;
  when: string;
  sub: string;
  titles: { title: string; when: string; current: boolean }[];
  bullets: string[];
  tech?: string;
}

export interface Achievement { title: string; detail: string; link?: Link }

export interface Content {
  lang: Lang;
  meta: { title: string; description: string };
  header: { name: string; role: string; meta: string[] };
  profile: string;
  projects: Project[];
  projectsMore: { text: string; link: Link };
  jobs: Job[];
  skills: { label: string; hi: boolean }[];
  education: {
    school: string;
    year: string;
    program: string;
    place: string;
    certs: { label: string; items: string[] };
  };
  achievements: Achievement[];
  contact: { card: string };
  ui: {
    sections: Record<Exclude<SectionId, 'top'>, string>;
    nav: Record<SectionId, string>;
    navLabel: string;
    skip: string;
    cvButton: string;
    cvMenu: string;
    cvFiles: [string, string, string, string];
    icons: { vk: string; telegram: string; github: string; cv: string; email: string; v1: string };
    lang: { label: string; href: string; hreflang: Lang; title: string };
  };
}
