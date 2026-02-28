# OG image generation — quirks & gotchas

OG images are generated at **build time** via `satori` + `@resvg/resvg-js`, prerendered as static PNG files (e.g. `build/og/home.png`). See `src/routes/og/` for route endpoints.

## Font loading

**Do not fetch from Google Fonts.** Google Fonts serves WOFF2, and satori's bundled `@shuding/opentype.js` only supports TTF and WOFF1 — it throws `"Unsupported OpenType signature wOF2"` on WOFF2 files.

Instead, use `@fontsource/dm-sans` (devDep) which provides WOFF1 files locally:

```ts
// node_modules/@fontsource/dm-sans/files/dm-sans-latin-{weight}-normal.woff
readFileSync(`node_modules/@fontsource/dm-sans/files/dm-sans-latin-${weight}-normal.woff`).buffer
```

Font data is loaded once per build process via a module-level cache in `src/lib/server/og-fonts.ts` — reused across all OG routes.

## SVG logo colours

`static/logo.svg` uses `oklch()` colour functions in `style` attributes. **resvg does not support `oklch()`** — the logo renders as transparent/wrong colours.

Fix: replace oklch values with hex equivalents at load time in each OG endpoint:

```ts
const logoSvg = readFileSync('static/logo.svg', 'utf-8')
  .replace(/oklch\(0\.35 0\.164 264\)/g,  '#0a2d8e')
  .replace(/oklch\(0\.259 0\.164 264\)/g, '#000b71')
  .replace(/oklch\(0\.22 0\.164 264\)/g,  '#010065')
  .replace(/oklch\(0\.18 0\.164 264\)/g,  '#040058')
  .replace(/oklch\(0\.42 0\.164 264\)/g,  '#1c43a5')
  .replace(/oklch\(0\.32 0\.164 264\)/g,  '#042384');
```

If the logo colours change, recompute the hex equivalents with this formula (Node.js):

```js
function oklchToHex(L, C, H) {
  const h = H * Math.PI / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774*a + 0.2158037573*b;
  const m_ = L - 0.1055613458*a - 0.0638541728*b;
  const s_ = L - 0.0894841775*a - 1.2914855480*b;
  const l = l_**3, m = m_**3, s = s_**3;
  const r = Math.max(0, 4.0767416621*l - 3.3077115913*m + 0.2309699292*s);
  const g = Math.max(0, -1.2684380046*l + 2.6097574011*m - 0.3413193965*s);
  const bv = Math.max(0, -0.0041960863*l - 0.7034186147*m + 1.7076147010*s);
  const toSRGB = x => x <= 0.0031308 ? 12.92*x : 1.055*x**(1/2.4) - 0.055;
  const toHex = x => Math.round(Math.min(1, toSRGB(x)) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(bv);
}
```

## Number formatting

**Do not use `\u202f` (narrow no-break space)** as a thousands separator. The WOFF1 font files from `@fontsource` do not include a glyph for it — it renders as a visible replacement character.

Use a regular space `' '` instead:

```ts
const count = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
```

## Author photo fetching (posts endpoint)

The posts OG endpoint (`src/routes/og/posts/[slug].png/+server.ts`) fetches each député's photo from `https://www2.assemblee-nationale.fr/static/tribun/17/photos/{id}.jpg` at build time. A module-level `Map` caches results so the same photo is only fetched once across all prerendered routes (useful when one author has many proposals).

```ts
const photoCache = new Map<string, string | null>();

async function fetchAuthorPhoto(photoFile: string): Promise<string | null> {
  if (photoCache.has(photoFile)) return photoCache.get(photoFile) ?? null;
  try {
    const res = await fetch(`https://www2.assemblee-nationale.fr/.../photos/${photoFile}`);
    if (!res.ok) { photoCache.set(photoFile, null); return null; }
    const buf = await res.arrayBuffer();
    const src = `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
    photoCache.set(photoFile, src);
    return src;
  } catch { photoCache.set(photoFile, null); return null; }
}
```

If the fetch fails or returns a non-200, the endpoint falls back to an initials avatar (no build failure).

## Right-panel text clipping

In satori, `alignItems: 'center'` on a flex column makes children shrink to their content width. Text that exceeds the shrunken box gets clipped silently. Fix: set an explicit `width` on any text element that may wrap inside a centred column:

```ts
el('span', { style: { textAlign: 'center', width: '280px', ... } }, text)
```

## TypeScript types

`satori` types its first argument as `React.ReactNode`. To avoid installing React at runtime, the OG endpoints define a local `Props`/`Child` type that is structurally compatible with `ReactElement`, and a small `el()` helper builds the element tree as plain objects. No `as` casting needed — the types line up structurally.
