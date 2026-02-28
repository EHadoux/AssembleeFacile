import type { RequestHandler, EntryGenerator } from './$types';
import type { ReactElement, CSSProperties } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { getAllAuteurs, getAuteurBySlug, getPostsByAuteur, slugify } from '$lib/server/content';
import { getOgFonts } from '$lib/server/og-fonts';
import { findDeputeByNameInDb, getAuthorCounts } from '$lib/server/queries';
import { getAllGroupes } from '$lib/server/groupes';

export const prerender = true;

export const entries: EntryGenerator = () =>
	getAllAuteurs().map((name) => ({ slug: slugify(name) }));

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
	const name = getAuteurBySlug(params.slug);
	if (!name) return new Response('Not found', { status: 404 });

	const fonts = getOgFonts();
	const posts = getPostsByAuteur(name);
	const dep = findDeputeByNameInDb(name);
	const counts = dep ? getAuthorCounts(dep.id) : { count_auteur: posts.length, count_cosig: 0 };
	const groupes = getAllGroupes();
	const groupe = dep ? (groupes.find((g) => g.abrev === dep.groupe_abrev) ?? null) : null;

	// Top 3 tags by frequency across this author's posts
	const tagCounts = new Map<string, { tag: string; count: number }>();
	for (const post of posts) {
		for (const tag of post.tags) {
			const key = slugify(tag);
			const ex = tagCounts.get(key);
			if (ex) ex.count++;
			else tagCounts.set(key, { tag, count: 1 });
		}
	}
	const topTags = [...tagCounts.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, 3)
		.map((t) => truncate(t.tag, 22));

	const photoSrc = dep?.photo ? await fetchAuthorPhoto(dep.photo) : null;

	const fullName = dep ? `${dep.prenom} ${dep.nom}` : name;
	const initials = fullName
		.split(' ')
		.map((w) => w[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();

	const groupeAbrev = dep?.groupe_abrev ?? null;
	const groupeNom = groupe?.nom ?? null;
	const groupeCouleur = groupe?.couleur ?? '#9ca3af';

	const participation =
		dep?.score_participation != null ? Math.round(dep.score_participation * 100) : null;

	const circoLabel =
		dep?.circo && dep?.departement_nom
			? `${dep.departement_nom} · ${dep.circo}e circonscription`
			: dep?.departement_nom ?? null;

	// ── Pre-build optional children ──────────────────────────────────────────

	const avatarEl = photoSrc
		? el('img', {
				src: photoSrc,
				width: 120,
				height: 120,
				alt: '',
				style: {
					borderRadius: '9999px',
					objectFit: 'cover',
					objectPosition: 'top',
					border: '4px solid rgba(255,255,255,0.9)',
				},
			})
		: el(
				'div',
				{
					style: {
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: '120px',
						height: '120px',
						borderRadius: '9999px',
						backgroundColor: BLUE,
						fontSize: 42,
						fontWeight: 800,
						color: WHITE,
					},
				},
				initials
			);

	const leftBadgeChildren: Child[] = groupeAbrev
		? [
				el(
					'span',
					{
						style: {
							display: 'flex',
							fontSize: 13,
							fontWeight: 700,
							color: WHITE,
							backgroundColor: groupeCouleur,
							borderRadius: '5px',
							padding: '5px 14px',
							letterSpacing: '0.05em',
						},
					},
					groupeAbrev
				),
			]
		: [];

	const groupeNomChildren: Child[] = groupeNom
		? [
				el(
					'span',
					{ style: { fontSize: 15, fontWeight: 400, color: SUBTLE, lineHeight: 1.3 } },
					groupeNom
				),
			]
		: [];

	const circoChildren: Child[] = circoLabel
		? [el('span', { style: { fontSize: 14, fontWeight: 400, color: MUTED } }, circoLabel)]
		: [];

	const participationChildren: Child[] = participation != null
		? [
				el(
					'div',
					{ style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
					el(
						'span',
						{ style: { fontSize: 44, fontWeight: 800, color: SLATE, lineHeight: 1 } },
						`${participation}%`
					),
					el(
						'span',
						{ style: { fontSize: 13, fontWeight: 400, color: MUTED } },
						'participation'
					)
				),
			]
		: [];

	const tagChildren: Child[] = topTags.map((tag) =>
		el(
			'span',
			{
				style: {
					display: 'flex',
					fontSize: 12,
					fontWeight: 700,
					color: BLUE,
					backgroundColor: '#e8edf8',
					borderRadius: '4px',
					padding: '5px 12px',
				},
			},
			tag
		)
	);

	const tree = el(
		'div',
		{
			style: {
				display: 'flex',
				width: '1200px',
				height: '630px',
				fontFamily: 'DM Sans',
				backgroundColor: WHITE,
			},
		},

		// ── Left panel (soft blue, fixed 260px) ──────────────────────────────
		el(
			'div',
			{
				style: {
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					width: '260px',
					backgroundColor: '#e8edf8',
					gap: '20px',
				},
			},
			avatarEl,
			...leftBadgeChildren
		),

		// ── Right panel (white, 940px) ────────────────────────────────────────
		el(
			'div',
			{
				style: {
					display: 'flex',
					flexDirection: 'column',
					width: '940px',
					padding: '52px 64px',
					justifyContent: 'space-between',
				},
			},

			// Brand row
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

			// Identity block: name + group + circo
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
				el(
					'span',
					{ style: { fontSize: 42, fontWeight: 800, color: SLATE, lineHeight: 1.1 } },
					truncate(fullName, 36)
				),
				...groupeNomChildren,
				...circoChildren
			),

			// Stats + tags
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
				// Stats row
				el(
					'div',
					{ style: { display: 'flex', gap: '56px', alignItems: 'flex-end' } },
					el(
						'div',
						{ style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
						el(
							'span',
							{ style: { fontSize: 44, fontWeight: 800, color: BLUE, lineHeight: 1 } },
							counts.count_auteur.toString()
						),
						el(
							'span',
							{ style: { fontSize: 13, fontWeight: 400, color: MUTED } },
							'propositions déposées'
						)
					),
					...participationChildren
				),
				// Tags row
				el('div', { style: { display: 'flex', gap: '8px' } }, ...tagChildren)
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
