import type { RequestHandler, EntryGenerator } from './$types';
import type { ReactElement, CSSProperties } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { getAllPosts, getPost } from '$lib/server/content';
import { getOgFonts } from '$lib/server/og-fonts';
import { getPostPrimaryAuthor, getCosignataireCount } from '$lib/server/queries';

export const prerender = true;

export const entries: EntryGenerator = () => getAllPosts().map(({ slug }) => ({ slug }));

type Child = ReactElement<Props> | string | number;
type Props = {
	style?: CSSProperties;
	children?: Child | Child[];
	src?: string;
	width?: number;
	height?: number;
	alt?: string;
};

function el(
	type: string,
	props: Omit<Props, 'children'> | null,
	...children: Child[]
): ReactElement<Props> {
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

function truncate(s: string, max: number): string {
	return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function formatDate(iso: string): string {
	return new Date(iso + 'T00:00:00Z').toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	});
}

// Module-level cache: avoids re-fetching the same photo across entries.
const photoCache = new Map<string, string | null>();

async function fetchAuthorPhoto(photoFile: string): Promise<string | null> {
	if (photoCache.has(photoFile)) return photoCache.get(photoFile) ?? null;
	try {
		const res = await fetch(
			`https://www2.assemblee-nationale.fr/static/tribun/17/photos/${photoFile}`
		);
		if (!res.ok) {
			photoCache.set(photoFile, null);
			return null;
		}
		const buf = await res.arrayBuffer();
		const src = `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
		photoCache.set(photoFile, src);
		return src;
	} catch {
		photoCache.set(photoFile, null);
		return null;
	}
}

// Load logo SVG once — oklch replaced by hex equivalents (resvg doesn't support oklch).
const logoSvg = readFileSync('static/logo.svg', 'utf-8')
	.replace(/oklch\(0\.35 0\.164 264\)/g, '#0a2d8e')
	.replace(/oklch\(0\.259 0\.164 264\)/g, '#000b71')
	.replace(/oklch\(0\.22 0\.164 264\)/g, '#010065')
	.replace(/oklch\(0\.18 0\.164 264\)/g, '#040058')
	.replace(/oklch\(0\.42 0\.164 264\)/g, '#1c43a5')
	.replace(/oklch\(0\.32 0\.164 264\)/g, '#042384');
const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

const BLUE = '#000091';
const SLATE = '#1e293b';
const MUTED = '#94a3b8';
const SUBTLE = '#64748b';
const WHITE = '#ffffff';

export const GET: RequestHandler = async ({ params }) => {
	const meta = getPost(params.slug);
	if (!meta) return new Response('Not found', { status: 404 });

	const fonts = getOgFonts();
	const author = getPostPrimaryAuthor(params.slug);
	const cosigCount = getCosignataireCount(params.slug);

	const photoSrc = author?.photo ? await fetchAuthorPhoto(author.photo) : null;

	const authorName = author ? `${author.prenom} ${author.nom}` : (meta.auteurs[0] ?? '');
	const authorInitial = authorName.split(' ').pop()?.[0] ?? '?';
	const groupeAbrev = author?.groupe_abrev ?? null;
	const groupeCouleur = author?.couleur ?? '#9ca3af';

	const lastIdx = meta.stepsName.length - 1;
	const lastStepName = lastIdx >= 0 ? meta.stepsName[lastIdx] : 'Déposée';
	const lastStepStatus = lastIdx >= 0 ? (meta.stepsStatus[lastIdx] ?? '') : '';

	const title = truncate(meta.proposalTitle, 90);
	const excerpt = truncate(meta.excerpt, 220);
	const depositDate = formatDate(meta.date);
	const visibleTags = meta.tags.slice(0, 3);

	// ── Pre-build optional children ──────────────────────────────────────────
	const badgeChildren: Child[] = groupeAbrev
		? [
				el(
					'span',
					{
						style: {
							display: 'flex',
							fontSize: 10,
							fontWeight: 700,
							color: WHITE,
							backgroundColor: groupeCouleur,
							borderRadius: '3px',
							padding: '2px 7px',
							letterSpacing: '0.05em',
						},
					},
					groupeAbrev
				),
			]
		: [];

	const stepStatusChildren: Child[] = lastStepStatus
		? [
				el(
					'span',
					{ style: { fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.6)' } },
					lastStepStatus
				),
			]
		: [];

	const avatarEl = photoSrc
		? el('img', {
				src: photoSrc,
				width: 60,
				height: 60,
				alt: '',
				style: { borderRadius: '9999px', objectFit: 'cover', objectPosition: 'top' },
			})
		: el(
				'div',
				{
					style: {
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: '60px',
						height: '60px',
						borderRadius: '9999px',
						backgroundColor: 'rgba(255,255,255,0.15)',
						fontSize: 22,
						fontWeight: 800,
						color: WHITE,
					},
				},
				authorInitial
			);

	const tree = el(
		'div',
		{
			style: {
				display: 'flex',
				flexDirection: 'column',
				width: '1200px',
				height: '630px',
				fontFamily: 'DM Sans',
				backgroundColor: WHITE,
			},
		},

		// ── Top panel (white) ──────────────────────────────────────────────────
		el(
			'div',
			{
				style: {
					display: 'flex',
					flexDirection: 'column',
					flexGrow: 1,
					padding: '52px 72px',
					justifyContent: 'space-between',
					borderBottom: '1px solid #e2e8f0',
				},
			},
			// Brand row — logo+name on left, URL on right
			el(
				'div',
				{ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
				el(
					'div',
					{ style: { display: 'flex', alignItems: 'center', gap: '14px' } },
					el('img', { src: logoSrc, width: 44, height: 44, alt: '' }),
					el(
						'div',
						{ style: { display: 'flex', flexDirection: 'column' } },
						el(
							'span',
							{ style: { fontSize: 18, fontWeight: 300, color: SLATE, lineHeight: 1.1 } },
							'Assemblée'
						),
						el(
							'span',
							{ style: { fontSize: 18, fontWeight: 800, color: BLUE, lineHeight: 1.1 } },
							'Facile'
						)
					)
				),
				el('span', { style: { fontSize: 13, fontWeight: 400, color: MUTED } }, 'anfacile.fr')
			),
			// Title + date + excerpt
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
				el(
					'span',
					{ style: { fontSize: 40, fontWeight: 800, color: SLATE, lineHeight: 1.2 } },
					title
				),
				el(
					'span',
					{ style: { fontSize: 13, fontWeight: 400, color: MUTED } },
					`N\u00b0\u00a0${meta.proposalNum}\u00a0\u00b7\u00a0${depositDate}`
				),
				el(
					'span',
					{ style: { fontSize: 15, fontWeight: 400, color: SUBTLE, lineHeight: 1.55 } },
					excerpt
				)
			),
			// Tags
			el(
				'div',
				{ style: { display: 'flex', gap: '8px' } },
				...visibleTags.map((tag) =>
					el(
						'span',
						{
							style: {
								display: 'flex',
								fontSize: 11,
								fontWeight: 700,
								color: BLUE,
								backgroundColor: '#e8edf8',
								borderRadius: '4px',
								padding: '3px 8px',
							},
						},
						tag
					)
				)
			)
		),

		// ── Bottom bar (blue) ──────────────────────────────────────────────────
		el(
			'div',
			{
				style: {
					display: 'flex',
					alignItems: 'center',
					height: '148px',
					backgroundColor: BLUE,
					padding: '0 72px',
				},
			},
			// Author section
			el(
				'div',
				{ style: { display: 'flex', alignItems: 'center', gap: '16px' } },
				avatarEl,
				el(
					'div',
					{
						style: {
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'flex-start',
							gap: '6px',
						},
					},
					el(
						'span',
						{ style: { fontSize: 16, fontWeight: 700, color: WHITE, lineHeight: 1.2 } },
						authorName
					),
					...badgeChildren
				)
			),
			// Vertical divider
			el('div', {
				style: {
					width: '1px',
					height: '64px',
					backgroundColor: 'rgba(255,255,255,0.2)',
					marginLeft: '48px',
					marginRight: '48px',
				},
			}),
			// Last step section
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', flexGrow: 1 } },
				el(
					'span',
					{
						style: {
							fontSize: 10,
							fontWeight: 400,
							color: 'rgba(255,255,255,0.5)',
							letterSpacing: '0.08em',
						},
					},
					'DERNIERE ETAPE'
				),
				el(
					'span',
					{ style: { fontSize: 17, fontWeight: 700, color: WHITE, lineHeight: 1.3 } },
					lastStepName
				),
				...stepStatusChildren
			),
			// Vertical divider
			el('div', {
				style: {
					width: '1px',
					height: '64px',
					backgroundColor: 'rgba(255,255,255,0.2)',
					marginLeft: '48px',
					marginRight: '48px',
				},
			}),
			// Cosignataires count section
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' } },
				el(
					'span',
					{ style: { fontSize: 44, fontWeight: 800, color: WHITE, lineHeight: 1 } },
					cosigCount.toString()
				),
				el(
					'span',
					{ style: { fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.7)' } },
					'cosignataires'
				)
			)
		)
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
