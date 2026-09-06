// Progressive enhancement only. The document is complete without this file:
// honour ?lang= by redirecting to the static document, then mark the current pill.
import { trackActiveSection } from './dom/pills.ts';

const lang = new URLSearchParams(location.search).get('lang');
const onRu = location.pathname.startsWith('/ru/');
if (lang === 'ru' && !onRu) location.replace(`/ru/${location.hash}`);
else if (lang === 'en' && onRu) location.replace(`/${location.hash}`);
else trackActiveSection();
