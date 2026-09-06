// Russian copy. Verbatim from the shipped CV (Resume/layout/resume-ru.html) plus the
// co-authored-paper fix. Em-dashes replaced structurally, see en.ts.
import type { Content } from './types.ts';

export const ru: Content = {
  lang: 'ru',
  meta: {
    title: 'Климентьев Владислав · C++ разработчик',
    description: 'Климентьев Владислав, C++/Qt-разработчик (Tools / Gameplay): резюме, проекты, CV в PDF, контакты.',
  },
  header: {
    name: 'Климентьев Владислав',
    role: 'C++ разработчик · Tools / Gameplay',
    meta: ['middle Qt/C++17', 'Unreal Engine · junior, самообучение', 'Барнаул · удалённо / переезд', 'Английский · B2'],
  },
  profile:
    'C++/Qt-разработчик. В «Сэд-Про» вырос с договора ГПХ до ведущего программиста за девять месяцев: отвечаю за стек, декомпозицию задач и сроки; продукт ежедневно используют 30 проектировщиков. Параллельно делаю игровой движок Donut-Engine (C++17 / Qt / QML / OpenGL) и реалтайм-игру CyberHockey2077. Ищу новую позицию в геймдеве (tools / gameplay, C++ / Unreal Engine).',
  projects: [
    {
      name: 'Donut-Engine',
      tagline: 'игровой движок с нуля, соло',
      bullets: [
        'OpenGL-рендер и импорт glTF 2.0 (tinygltf): меши и PBR-материалы (base color, metallic-roughness, карты нормалей).',
        'Интеграция движка в Qt Quick через кастомный QQuickItem; модульная архитектура core / renderer / quick.',
      ],
      tech: 'C++17 · Qt 6 · QML · OpenGL · glTF 2.0 · CMake',
    },
    {
      name: 'CyberHockey2077',
      tagline: 'реалтайм аэрохоккей 1v1, Telegram Mini App',
      bullets: ['Синхронизация состояния клиент-сервер по WebSocket, AI-рефери; собственная физика.'],
      tech: 'React · TypeScript · WebSocket · Node.js',
    },
    {
      name: 'Revenant',
      tagline: 'сайт на заказ для мастерской по ремонту ПК: спроектирован и поставлен соло, в проде',
      bullets: [],
      link: { href: 'https://ревенант.рф', label: 'ревенант.рф' },
    },
  ],
  projectsMore: { text: 'демо и детали', link: { href: 'https://me.cryzothic.tech', label: 'me.cryzothic.tech' } },
  jobs: [
    {
      company: 'ООО АК «Сэд-Про»',
      place: 'Барнаул',
      when: 'дек 2024 - н. в.',
      sub: 'Разработка ПО для проектной отрасли; основной пользователь платформы: архитектурно-конструкторское бюро «Инвестпроект».',
      titles: [
        { title: 'Ведущий программист', when: 'авг 2025 - н. в.', current: true },
        { title: 'Программист', when: 'дек 2024 - авг 2025', current: false },
      ],
      bullets: [
        'Руковожу разработкой: технический стек, декомпозиция задач, сроки; в подчинении 1 (2) программиста, основную часть C++-кода пишу сам.',
        'Разработал SQL-first платформу («no-code, SQL-code»): формы, виджеты и логика кнопок описываются в MySQL, Qt-клиент отрисовывает их; экраны перенастраиваются на лету, без пересборки.',
        'Автоматизировал цикл «заявка → выдача проекта» для 30 проектировщиков (включая ГИПов и конструкторов): автосборка проекта, отказ от ручной передачи файлов и заданий.',
        'Спроектировал поверсионную (svn-based) работу с файлами (единица версии: лист DWG / XLSX / PDF) и электронный документооборот.',
      ],
      tech: 'C++ · Qt Widgets · MySQL',
    },
    {
      company: 'Завод промышленной автоматизации (NDA)',
      place: '',
      when: 'фев - мар 2024',
      sub: 'Оборудование АЗС · Инженер-стажёр',
      titles: [],
      bullets: [
        'Программировал и настраивал микроконтроллеры для танкерных систем АЗС; перевёл рабочий сервер на Astra Linux (C#). Инфраструктура под NDA.',
      ],
    },
  ],
  skills: [
    { label: 'C++17/20', hi: true }, { label: 'Qt', hi: true }, { label: 'OpenGL', hi: true },
    { label: 'EASTL', hi: false }, { label: 'raylib', hi: false }, { label: 'CMake', hi: false },
    { label: 'STL', hi: false }, { label: 'Boost', hi: false }, { label: 'SQL', hi: false },
    { label: 'Git', hi: false }, { label: 'ООП', hi: false }, { label: 'Алгоритмы и структуры данных', hi: false },
    { label: 'Unreal Engine', hi: false },
  ],
  education: {
    school: 'Колледж АлтГУ',
    year: '2023',
    program: '«Информационные системы и программирование»',
    place: 'Барнаул',
    certs: {
      label: 'Сертификаты 2022',
      items: ['Введение в программирование (C++)', 'Программирование на C++', 'Разработка игр на Unreal Engine', 'Геймификация: введение'],
    },
  },
  achievements: [
    {
      title: 'Лауреат',
      detail: 'Краевой олимпиады профессионального мастерства, направление «Информатика и ВТ» (2023)',
      link: { href: 'https://www.asu.ru/university_life/students/winners/news/press/48410/', label: 'статья, asu.ru' },
    },
    { title: 'Диплом II степени', detail: "региональная олимпиада «Информационные технологии» РСО_ИТ'2023 (ГАГУ)" },
    {
      title: 'Статья в соавторстве «Эволюция точечных дефектов в кристалле ГЦК»',
      detail: 'VI Международная НПК, Москва, 2023; индексация РИНЦ (eLibrary.ru)',
    },
    { title: 'Hackathon Barnaul', detail: 'участник (2021)' },
  ],
  contact: { card: 'Vlad Klimentev C++/Qt' },
  ui: {
    sections: {
      profile: 'О себе', projects: 'Проекты', experience: 'Опыт работы', skills: 'Ключевые навыки',
      education: 'Образование', achievements: 'Достижения', contact: 'Контакты',
    },
    nav: {
      top: 'Наверх', profile: 'О себе', projects: 'Проекты', experience: 'Опыт', skills: 'Навыки',
      education: 'Образование', achievements: 'Достижения', contact: 'Контакты',
    },
    navLabel: 'Разделы',
    skip: 'К резюме',
    cvButton: 'CV (PDF)',
    cvMenu: 'CV',
    cvFiles: ['Английское (PDF)', 'Русское (PDF)', 'Английское, без оформления для парсеров (PDF)', 'Русское, без оформления для парсеров (PDF)'],
    icons: { vk: 'VK', telegram: 'Telegram', github: 'GitHub', cv: 'CV', email: 'Почта', v1: 'Предыдущий сайт, me.cryzothic.tech' },
    lang: { label: 'EN', href: '/', hreflang: 'en', title: 'English version' },
  },
};
