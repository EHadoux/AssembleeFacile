import type { RequestHandler } from './$types';
import type { ReactElement, CSSProperties } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { getAllPosts } from '$lib/server/content';
import { getOgFonts } from '$lib/server/og-fonts';

export const prerender = true;

type Child = ReactElement<Props> | string | number;
type Props = { style?: CSSProperties; children?: Child | Child[]; src?: string; width?: number; height?: number; alt?: string };

function el(type: string, props: Omit<Props, 'children'> | null, ...children: Child[]): ReactElement<Props> {
	return {
		type,
		key: null,
		props: {
			...(props ?? {}),
			children:
				children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
		},
	};
}

export const GET: RequestHandler = async () => {
	const totalPosts = getAllPosts().length;
	const fonts = getOgFonts();

	// Load logo SVG with oklch colors replaced by hex equivalents (resvg doesn't support oklch).
	const logoSvg = readFileSync('static/logo.svg', 'utf-8')
		.replace(/oklch\(0\.35 0\.164 264\)/g, '#0a2d8e')
		.replace(/oklch\(0\.259 0\.164 264\)/g, '#000b71')
		.replace(/oklch\(0\.22 0\.164 264\)/g, '#010065')
		.replace(/oklch\(0\.18 0\.164 264\)/g, '#040058')
		.replace(/oklch\(0\.42 0\.164 264\)/g, '#1c43a5')
		.replace(/oklch\(0\.32 0\.164 264\)/g, '#042384');
	const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

	// Regular space as thousands separator (narrow no-break space has no glyph in the font).
	const count = totalPosts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

	const tree = el(
		'div',
		{ style: { display: 'flex', width: '1200px', height: '630px', fontFamily: 'DM Sans', backgroundColor: '#ffffff' } },

		// ── Left panel ──────────────────────────────────────────────────────────
		el(
			'div',
			{
				style: {
					display: 'flex',
					flexDirection: 'column',
					flexGrow: 1,
					padding: '64px 72px',
					justifyContent: 'space-between',
					borderRight: '1px solid #e2e8f0',
				},
			},

			// Brand row: logo + "Assemblée / Facile"
			el(
				'div',
				{ style: { display: 'flex', alignItems: 'center', gap: '18px' } },
				el('img', { src: logoSrc, width: 68, height: 68, alt: '' }),
				el(
					'div',
					{ style: { display: 'flex', flexDirection: 'column' } },
					el('span', { style: { fontSize: 28, fontWeight: 300, color: '#1e293b', lineHeight: 1.1 } }, 'Assemblée'),
					el('span', { style: { fontSize: 28, fontWeight: 800, color: '#000091', lineHeight: 1.1 } }, 'Facile'),
				),
			),

			// Headline
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column' } },
				el('span', { style: { fontSize: 50, fontWeight: 800, color: '#1e293b', lineHeight: 1.2 } }, 'Les propositions de loi,'),
				el('span', { style: { fontSize: 50, fontWeight: 800, color: '#000091', lineHeight: 1.2 } }, 'expliquées clairement.'),
			),

			// URL
			el('span', { style: { fontSize: 18, fontWeight: 400, color: '#94a3b8' } }, 'anfacile.fr'),
		),

		// ── Right panel (French blue) ────────────────────────────────────────────
		el(
			'div',
			{
				style: {
					display: 'flex',
					flexDirection: 'column',
					width: '360px',
					backgroundColor: '#000091',
					padding: '64px 48px',
					justifyContent: 'center',
				},
			},
			el('span', { style: { fontSize: 72, fontWeight: 800, color: '#ffffff', lineHeight: 1 } }, count),
			el('span', { style: { fontSize: 22, fontWeight: 700, color: '#ffffff', marginTop: 12 } }, 'propositions'),
			el('span', { style: { fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.7)' } }, 'de loi indexées'),
			el('div', { style: { width: 40, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 28, marginBottom: 28 } }),
			el('span', { style: { fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.6)' } }, '17e législature'),
			el('span', { style: { fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.6)', marginTop: 4 } }, 'Assemblée nationale'),
		),
	);

	const svg = await satori(tree, { width: 1200, height: 630, fonts });
	const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400, immutable',
		},
	});
};
