/** Reading font loader. */
// Andika: a typeface designed for beginning readers (single-storey a, clear b/d/p/q).
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Andika:wght@400;700&display=swap';
export function ensureReadingFont(): void {
  try {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONT_HREF;
    document.head.appendChild(l);
  } catch {
    /* fallback fonts are fine */
  }
}
