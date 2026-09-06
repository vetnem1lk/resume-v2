// English copy. Verbatim from the shipped CV (Resume/layout/resume-en.html) plus the
// three fixes recorded in the design doc: co-authored paper, Sed-Pro sub-line, OOP chip.
// Em-dashes of the CV are replaced structurally: ranges use an en dash, "name: tagline"
// heads are two fields, prose dashes become colons, parentheses or semicolons.
import type { Content } from './types.ts';

export const en: Content = {
  lang: 'en',
  meta: {
    title: 'Vladislav Klimentev · C++ Developer',
    description: 'Vladislav Klimentev, C++/Qt developer (Tools / Gameplay): resume, projects, CV in PDF, contacts.',
  },
  header: {
    name: 'Vladislav Klimentev',
    role: 'C++ Developer · Tools / Gameplay',
    meta: ['middle Qt/C++17', 'Unreal Engine · junior, self-study', 'Barnaul · remote / relocation', 'English · B2'],
  },
  profile:
    'C++/Qt developer with production experience shipping desktop tooling used daily by a 30-seat engineering bureau. Grew from contractor to Lead Programmer in nine months: own the tech stack, task scoping and delivery. On the side, building the Donut-Engine game engine (C++17 / Qt / QML / OpenGL) and the real-time game CyberHockey2077. Looking for a new position in game development (tools / gameplay, C++ / Unreal Engine).',
  projects: [
    {
      name: 'Donut-Engine',
      tagline: 'game engine built from scratch, solo',
      bullets: [
        'OpenGL renderer and a glTF 2.0 import pipeline (tinygltf): meshes and PBR materials (base color, metallic-roughness, normal maps).',
        'Engine integrated into Qt Quick through a custom QQuickItem render hook; modular core / renderer / quick architecture.',
      ],
      tech: 'C++17 · Qt 6 · QML · OpenGL · glTF 2.0 · CMake',
    },
    {
      name: 'CyberHockey2077',
      tagline: 'real-time 1v1 air hockey, Telegram Mini App',
      bullets: ['Client-server state sync over WebSocket with an AI referee layer; custom physics.'],
      tech: 'React · TypeScript · WebSocket · Node.js',
    },
    {
      name: 'Revenant',
      tagline: 'commissioned site for a PC repair workshop, designed and shipped solo, in production',
      bullets: [],
      link: { href: 'https://ревенант.рф', label: 'ревенант.рф' },
    },
  ],
  projectsMore: { text: 'demos & details', link: { href: 'https://me.cryzothic.tech', label: 'me.cryzothic.tech' } },
  jobs: [
    {
      company: 'Sed-Pro LLC',
      place: 'Barnaul',
      when: 'Dec 2024 – present',
      sub: "Software development for the design industry; the platform's main user is the architecture & engineering bureau Investproekt.",
      titles: [
        { title: 'Lead Programmer', when: 'Aug 2025 – present', current: true },
        { title: 'Programmer', when: 'Dec 2024 – Aug 2025', current: false },
      ],
      bullets: [
        'Own tech stack, scoping and deadlines; hands-on lead with 1 (2) engineers reporting to me.',
        'Built an SQL-first platform ("no-code, SQL-code"): forms, widgets and button logic are defined in MySQL, the Qt Widgets client renders them; screens are reshaped on the fly, without C++ rebuilds.',
        'Automated the order-to-delivery pipeline for 30 designers (incl. chief project engineers): automatic project assembly, no manual file or task handoff.',
        'Designed svn-based, sheet-level file versioning (DWG / XLSX / PDF) and electronic document flow.',
      ],
      tech: 'C++ · Qt Widgets · MySQL',
    },
    {
      company: 'Industrial automation plant (NDA)',
      place: '',
      when: 'Feb – Mar 2024',
      sub: 'Fuel-station tanker systems · Software Engineering Intern',
      titles: [],
      bullets: [
        'Programmed and configured microcontrollers for fuel-tanker equipment; migrated a production server to Astra Linux (C#). Sensitive infrastructure under NDA.',
      ],
    },
  ],
  skills: [
    { label: 'C++17/20', hi: true }, { label: 'Qt', hi: true }, { label: 'OpenGL', hi: true },
    { label: 'EASTL', hi: false }, { label: 'raylib', hi: false }, { label: 'CMake', hi: false },
    { label: 'STL', hi: false }, { label: 'Boost', hi: false }, { label: 'SQL', hi: false },
    { label: 'Git', hi: false }, { label: 'OOP', hi: false }, { label: 'Data structures & algorithms', hi: false },
    { label: 'Unreal Engine', hi: false },
  ],
  education: {
    school: 'Altai State University College',
    year: '2023',
    program: 'Information Systems and Programming',
    place: 'Barnaul',
    certs: {
      label: 'Certificates 2022',
      items: ['Introduction to Programming (C++)', 'C++ Programming', 'Game Development with Unreal Engine', 'Gamification: Introduction'],
    },
  },
  achievements: [
    {
      title: 'Laureate',
      detail: 'Altai Krai Professional Skills Olympiad, CS & engineering track (2023)',
      link: { href: 'https://www.asu.ru/university_life/students/winners/news/press/48410/', label: 'article, asu.ru' },
    },
    { title: 'Diploma II degree', detail: "Regional IT olympiad RSO-IT'2023 (Gorno-Altaisk SU)" },
    {
      title: 'Co-authored paper "Evolution of Point Defects in an FCC Crystal"',
      detail: 'VI Int. Research & Practice Conference, Moscow 2023; indexed in RSCI (eLibrary.ru)',
    },
    { title: 'Hackathon Barnaul', detail: 'participant (2021)' },
  ],
  contact: { card: 'Vlad Klimentev C++/Qt' },
  ui: {
    sections: {
      profile: 'Profile', projects: 'Projects', experience: 'Experience', skills: 'Skills',
      education: 'Education', achievements: 'Achievements', contact: 'Contact',
    },
    nav: {
      top: 'Top', profile: 'Profile', projects: 'Projects', experience: 'Experience', skills: 'Skills',
      education: 'Education', achievements: 'Achievements', contact: 'Contact',
    },
    navLabel: 'Sections',
    skip: 'Skip to the resume',
    cvButton: 'CV (PDF)',
    cvMenu: 'CV',
    cvFiles: ['English (PDF)', 'Russian (PDF)', 'English, plain for parsers (PDF)', 'Russian, plain for parsers (PDF)'],
    icons: { vk: 'VK', telegram: 'Telegram', github: 'GitHub', cv: 'CV', email: 'Email', v1: 'Previous site, me.cryzothic.tech' },
    lang: { label: 'RU', href: '/ru/', hreflang: 'ru', title: 'Русская версия' },
  },
};
