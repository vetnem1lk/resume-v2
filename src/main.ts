// Progressive enhancement only. The document is complete without this file:
// honour ?lang= by redirecting to the static document, then mark the current pill.
import { trackActiveSection } from './dom/pills.ts';
import { boot, readEnv } from './scene/boot.ts';
import { WIDE } from './scene/gate.ts';

const lang = new URLSearchParams(location.search).get('lang');
const onRu = location.pathname.startsWith('/ru/');
if (lang === 'ru' && !onRu) location.replace(`/ru/${location.hash}`);
else if (lang === 'en' && onRu) location.replace(`/${location.hash}`);
else trackActiveSection();

// The scene is one lazy chunk behind a three-signal gate (wide viewport, WebGL2, no data saver).
// A rejected import() leaves the poster and is never retried; a window that grows past the
// breakpoint later gets one more try. Nothing here listens to vite:preloadError: a
// preventDefault() there would turn a failed chunk into a silent success.
const tryMount = () => boot(readEnv(window), () => import('./island/island.ts'));
void tryMount().then((result) => {
  if (result.kind !== 'poster' || result.reason !== 'narrow') return;
  const wide = matchMedia(WIDE);
  const onChange = (): void => {
    wide.removeEventListener('change', onChange);
    void tryMount();
  };
  wide.addEventListener('change', onChange);
});

// import.meta.env.DEV is replaced by the literal `false` in `vite build`, so this branch and the
// module behind it are dropped: no chunk is emitted for the overlay even beside the real import()
// above (measured). The DEV token has to be lexically in this module, next to the import().
if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
  void import('./debug/overlay.ts');
}
