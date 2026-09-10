// Progressive enhancement only. The document is complete without this file:
// honour ?lang= by redirecting to the static document, then mark the current pill.
import { trackActiveSection } from './dom/pills.ts';

const lang = new URLSearchParams(location.search).get('lang');
const onRu = location.pathname.startsWith('/ru/');
if (lang === 'ru' && !onRu) location.replace(`/ru/${location.hash}`);
else if (lang === 'en' && onRu) location.replace(`/${location.hash}`);
else trackActiveSection();

// import.meta.env.DEV is replaced by the literal `false` in `vite build`, so this branch and the
// module behind it are dropped: no chunk is emitted and the entry is byte identical to a build
// without these lines. The DEV token has to be lexically in this module, next to the import():
// routed through an imported constant, the call site still dies but an orphan chunk is emitted.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
  void import('./debug/overlay.ts');
}
