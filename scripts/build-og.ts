/**
 * Pre-generates all OG images (home + posts + auteurs) as static PNG files in static/og/.
 * Run this AFTER seeding the DB and updating étapes, and BEFORE vite build.
 *
 * Photos are cached on disk in assets/og-photo-cache/ to avoid re-fetching on every build.
 */

import {
	readdirSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { parse as parseTOML } from 'smol-toml';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import cliProgress from 'cli-progress';
import type { ReactElement, CSSProperties } from 'react';
import type { SatoriOptions } from 'satori';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const postsDir = join(root, 'content/posts');
const outBase = join(root, 'static/og');
const photoCacheDir = join(root, 'assets/og-photo-cache');

mkdirSync(join(outBase, 'posts'), { recursive: true });
mkdirSync(join(outBase, 'auteurs'), { recursive: true });
mkdirSync(photoCacheDir, { recursive: true });

// ── DB ────────────────────────────────────────────────────────────────────────
const db = new DatabaseSync(join(root, 'db/assemblee.db'));

// ── Fonts ─────────────────────────────────────────────────────────────────────
function loadFont(weight: number): NonNullable<SatoriOptions['fonts']>[number] {
	const path = join(
		root,
		`node_modules/@fontsource/dm-sans/files/dm-sans-latin-${weight}-normal.woff`
	);
	return { name: 'DM Sans', data: readFileSync(path).buffer as ArrayBuffer, weight, style: 'normal' };
}
const fonts = ([400, 700, 800] as const).map(loadFont);

// ── Logo ──────────────────────────────────────────────────────────────────────
const logoSvg = readFileSync(join(root, 'static/logo.svg'), 'utf-8')
	.replace(/oklch\(0\.35 0\.164 264\)/g, '#0a2d8e')
	.replace(/oklch\(0\.259 0\.164 264\)/g, '#000b71')
	.replace(/oklch\(0\.22 0\.164 264\)/g, '#010065')
	.replace(/oklch\(0\.18 0\.164 264\)/g, '#040058')
	.replace(/oklch\(0\.42 0\.164 264\)/g, '#1c43a5')
	.replace(/oklch\(0\.32 0\.164 264\)/g, '#042384');
const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

// ── Colours ───────────────────────────────────────────────────────────────────
const BLUE = '#000091';
const SLATE = '#1e293b';
const MUTED = '#94a3b8';
const SUBTLE = '#64748b';
const WHITE = '#ffffff';

// ── Element helper ─────────────────────────────────────────────────────────────
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

// ── Photo cache ───────────────────────────────────────────────────────────────
const inMemoryPhotoCache = new Map<string, string | null>();

async function fetchPhoto(photoFile: string): Promise<string | null> {
	const cached = inMemoryPhotoCache.get(photoFile);
	if (cached !== undefined) return cached;

	const diskPath = join(photoCacheDir, photoFile);
	if (existsSync(diskPath)) {
		const data = readFileSync(diskPath);
		const src = `data:image/jpeg;base64,${data.toString('base64')}`;
		inMemoryPhotoCache.set(photoFile, src);
		return src;
	}

	try {
		const res = await fetch(
			`https://www2.assemblee-nationale.fr/static/tribun/17/photos/${photoFile}`
		);
		if (!res.ok) {
			inMemoryPhotoCache.set(photoFile, null);
			return null;
		}
		const buf = await res.arrayBuffer();
		writeFileSync(diskPath, Buffer.from(buf));
		const src = `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
		inMemoryPhotoCache.set(photoFile, src);
		return src;
	} catch {
		inMemoryPhotoCache.set(photoFile, null);
		return null;
	}
}

async function prefetchPhotos(photoFiles: string[]): Promise<void> {
	const unique = [...new Set(photoFiles.filter(Boolean))];
	const BATCH = 20;
	for (let i = 0; i < unique.length; i += BATCH) {
		await Promise.all(unique.slice(i, i + BATCH).map(fetchPhoto));
	}
}

// ── Render helper ─────────────────────────────────────────────────────────────
async function renderPng(tree: ReactElement<Props>): Promise<Buffer> {
	const svg = await satori(tree, { width: 1200, height: 630, fonts });
	return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}

// ── Content reading ────────────────────────────────────────────────────────────
function slugify(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/[\s_]+/g, '-')
		.replace(/-+/g, '-');
}

function extractExcerpt(raw: string, maxChars = 200): string {
	const match = raw.match(/## Résumé\s*\n+([\s\S]+?)(?=\n+##|$)/);
	if (!match) return '';
	const text = match[1].replace(/\*\*/g, '').replace(/\*/g, '').trim();
	return text.length > maxChars ? text.slice(0, maxChars).trimEnd() + '…' : text;
}

interface PostMeta {
	slug: string;
	proposalTitle: string;
	proposalNum: number;
	date: string;
	tags: string[];
	auteurs: string[];
	stepsName: string[];
	stepsStatus: string[];
	excerpt: string;
}

function loadAllPosts(): PostMeta[] {
	const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
	return files
		.map((file) => {
			const raw = readFileSync(join(postsDir, file), 'utf-8');
			const match = raw.match(/^\+{3}\r?\n([\s\S]*?)\r?\n\+{3}\r?\n([\s\S]*)$/);
			if (!match) return null;
			const [, fm, body] = match;
			const meta = parseTOML(fm);
			const slug = file.replace('.md', '');
			const numMatch = slug.match(/n-(\d+)$/);
			const proposalNum = numMatch ? parseInt(numMatch[1], 10) : 0;
			const rawTitle = (meta?.title as string) ?? slug;
			const proposalTitle = rawTitle.includes(' - N° ')
				? rawTitle.split(' - N° ')[0]
				: rawTitle;

			const rawDate = meta?.date;
			let date = '';
			if (rawDate instanceof Date) {
				date = rawDate.toISOString().split('T')[0];
			} else if (typeof rawDate === 'string') {
				date = rawDate;
			}

			return {
				slug,
				proposalTitle,
				proposalNum,
				date,
				tags: (meta?.tags as string[]) ?? [],
				auteurs: (meta?.auteurs as string[]) ?? [],
				stepsName: (meta?.stepsName as string[]) ?? [],
				stepsStatus: (meta?.stepsStatus as string[]) ?? [],
				excerpt: extractExcerpt(body),
			} satisfies PostMeta;
		})
		.filter((p): p is PostMeta => p !== null)
		.sort((a, b) => b.proposalNum - a.proposalNum);
}

// ── DB helpers ─────────────────────────────────────────────────────────────────
interface PostOgAuthor {
	nom: string;
	prenom: string;
	groupe_abrev: string | null;
	couleur: string | null;
	photo: string | null;
}

function getPostPrimaryAuthor(slug: string): PostOgAuthor | null {
	const row = db
		.prepare(
			`SELECT d.nom, d.prenom, d.groupe_abrev, g.couleur,
			        REPLACE(d.id, 'PA', '') || '.jpg' AS photo
			 FROM article_auteurs aa
			 JOIN deputes d ON d.id = aa.depute_id
			 LEFT JOIN groupes g ON g.abrev = d.groupe_abrev
			 WHERE aa.article_slug = ? AND (aa.role = 'auteur' OR (aa.role IS NULL AND aa.ordre = 0))
			 LIMIT 1`
		)
		.get(slug);
	return (row as PostOgAuthor | undefined) ?? null;
}

function getCosignataireCount(slug: string): number {
	const row = db
		.prepare(`SELECT COUNT(*) AS count FROM article_auteurs WHERE article_slug = ? AND ordre > 0`)
		.get(slug) as { count: number };
	return row.count;
}

interface DeputeDetail {
	id: string;
	nom: string;
	prenom: string;
	groupe_abrev: string | null;
	photo: string | null;
	departement_nom: string | null;
	circo: number | null;
	score_participation: number | null;
}

let _deputesCache: DeputeDetail[] | null = null;
function getAllDeputes(): DeputeDetail[] {
	if (_deputesCache) return _deputesCache;
	_deputesCache = db
		.prepare(
			`SELECT id, nom, prenom, groupe_abrev, REPLACE(id, 'PA', '') || '.jpg' AS photo,
			        departement_nom, circo, score_participation
			 FROM deputes`
		)
		.all() as unknown as DeputeDetail[];
	return _deputesCache;
}

function normalizeStr(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function findDeputeByName(fullName: string): DeputeDetail | null {
	const deputes = getAllDeputes();
	const norm = normalizeStr(fullName);

	for (const d of deputes) {
		const a = normalizeStr(`${d.prenom} ${d.nom}`);
		const b = normalizeStr(`${d.nom} ${d.prenom}`);
		if (norm === a || norm === b) return d;
	}
	for (const d of deputes) {
		const n = normalizeStr(d.nom);
		const p = normalizeStr(d.prenom);
		if (n && p && norm.includes(n) && norm.includes(p)) return d;
	}
	for (const d of deputes) {
		const n = normalizeStr(d.nom);
		if (n && (norm === n || norm.endsWith(' ' + n))) return d;
	}
	return null;
}

function getAuthorCounts(deputeId: string): { count_auteur: number; count_cosig: number } {
	return db
		.prepare(
			`SELECT
				COUNT(DISTINCT CASE WHEN role = 'auteur' OR (role IS NULL AND ordre = 0) THEN article_slug END) AS count_auteur,
				COUNT(DISTINCT CASE WHEN role = 'cosignataire' THEN article_slug END) AS count_cosig
			 FROM article_auteurs WHERE depute_id = ?`
		)
		.get(deputeId) as { count_auteur: number; count_cosig: number };
}

interface Groupe {
	nom: string;
	abrev: string;
	couleur: string;
}

let _groupesCache: Map<string, Groupe> | null = null;
function getGroupeMap(): Map<string, Groupe> {
	if (_groupesCache) return _groupesCache;
	const rows = db
		.prepare('SELECT nom, abrev, couleur FROM groupes')
		.all() as unknown as Groupe[];
	_groupesCache = new Map(rows.map((g) => [g.abrev, g]));
	return _groupesCache;
}

// ── Home OG ───────────────────────────────────────────────────────────────────
async function generateHome(totalPosts: number): Promise<void> {
	const count = totalPosts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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
			el(
				'div',
				{ style: { display: 'flex', alignItems: 'center', gap: '18px' } },
				el('img', { src: logoSrc, width: 68, height: 68, alt: '' }),
				el(
					'div',
					{ style: { display: 'flex', flexDirection: 'column' } },
					el(
						'span',
						{ style: { fontSize: 28, fontWeight: 300, color: SLATE, lineHeight: 1.1 } },
						'Assemblée'
					),
					el(
						'span',
						{ style: { fontSize: 28, fontWeight: 800, color: BLUE, lineHeight: 1.1 } },
						'Facile'
					)
				)
			),
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column' } },
				el(
					'span',
					{ style: { fontSize: 50, fontWeight: 800, color: SLATE, lineHeight: 1.2 } },
					'Les propositions de loi,'
				),
				el(
					'span',
					{ style: { fontSize: 50, fontWeight: 800, color: BLUE, lineHeight: 1.2 } },
					'expliquées clairement.'
				)
			),
			el('span', { style: { fontSize: 18, fontWeight: 400, color: MUTED } }, 'anfacile.fr')
		),
		el(
			'div',
			{
				style: {
					display: 'flex',
					flexDirection: 'column',
					width: '360px',
					backgroundColor: BLUE,
					padding: '64px 48px',
					justifyContent: 'center',
				},
			},
			el('span', { style: { fontSize: 72, fontWeight: 800, color: WHITE, lineHeight: 1 } }, count),
			el(
				'span',
				{ style: { fontSize: 22, fontWeight: 700, color: WHITE, marginTop: 12 } },
				'propositions'
			),
			el(
				'span',
				{ style: { fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.7)' } },
				'de loi indexées'
			),
			el('div', {
				style: {
					width: 40,
					height: 2,
					backgroundColor: 'rgba(255,255,255,0.3)',
					marginTop: 28,
					marginBottom: 28,
				},
			}),
			el(
				'span',
				{ style: { fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.6)' } },
				'17e législature'
			),
			el(
				'span',
				{ style: { fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.6)', marginTop: 4 } },
				'Assemblée nationale'
			)
		)
	);

	const png = await renderPng(tree);
	writeFileSync(join(outBase, 'home.png'), png);
}

// ── Post OG ────────────────────────────────────────────────────────────────────
async function generatePost(post: PostMeta): Promise<void> {
	const author = getPostPrimaryAuthor(post.slug);
	const cosigCount = getCosignataireCount(post.slug);
	const photoSrc = author?.photo ? await fetchPhoto(author.photo) : null;

	const authorName = author ? `${author.prenom} ${author.nom}` : (post.auteurs[0] ?? '');
	const authorInitial = authorName.split(' ').pop()?.[0] ?? '?';
	const groupeAbrev = author?.groupe_abrev ?? null;
	const groupeCouleur = author?.couleur ?? '#9ca3af';

	const lastIdx = post.stepsName.length - 1;
	const lastStepName = lastIdx >= 0 ? post.stepsName[lastIdx] : 'Déposée';
	const lastStepStatus = lastIdx >= 0 ? (post.stepsStatus[lastIdx] ?? '') : '';

	const title = truncate(post.proposalTitle, 90);
	const excerpt = truncate(post.excerpt, 220);
	const depositDate = formatDate(post.date);
	const visibleTags = post.tags.slice(0, 3);

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
					`N\u00b0\u00a0${post.proposalNum}\u00a0\u00b7\u00a0${depositDate}`
				),
				el(
					'span',
					{ style: { fontSize: 15, fontWeight: 400, color: SUBTLE, lineHeight: 1.55 } },
					excerpt
				)
			),
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
			el('div', {
				style: {
					width: '1px',
					height: '64px',
					backgroundColor: 'rgba(255,255,255,0.2)',
					marginLeft: '48px',
					marginRight: '48px',
				},
			}),
			el(
				'div',
				{
					style: {
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'flex-start',
						gap: '4px',
						flexGrow: 1,
					},
				},
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
			el('div', {
				style: {
					width: '1px',
					height: '64px',
					backgroundColor: 'rgba(255,255,255,0.2)',
					marginLeft: '48px',
					marginRight: '48px',
				},
			}),
			el(
				'div',
				{
					style: {
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: '4px',
					},
				},
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

	const png = await renderPng(tree);
	writeFileSync(join(outBase, 'posts', `${post.slug}.png`), png);
}

// ── Auteur OG ─────────────────────────────────────────────────────────────────
async function generateAuteur(name: string, posts: PostMeta[]): Promise<void> {
	const slug = slugify(name);
	const dep = findDeputeByName(name);
	const groupeMap = getGroupeMap();
	const counts = dep
		? getAuthorCounts(dep.id)
		: { count_auteur: posts.length, count_cosig: 0 };
	const groupe = dep?.groupe_abrev ? (groupeMap.get(dep.groupe_abrev) ?? null) : null;

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

	const photoSrc = dep?.photo ? await fetchPhoto(dep.photo) : null;
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
		? [el('span', { style: { fontSize: 15, fontWeight: 400, color: SUBTLE, lineHeight: 1.3 } }, groupeNom)]
		: [];

	const circoChildren: Child[] = circoLabel
		? [el('span', { style: { fontSize: 14, fontWeight: 400, color: MUTED } }, circoLabel)]
		: [];

	const participationChildren: Child[] =
		participation != null
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
			el(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
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
				el('div', { style: { display: 'flex', gap: '8px' } }, ...tagChildren)
			)
		)
	);

	const png = await renderPng(tree);
	writeFileSync(join(outBase, 'auteurs', `${slug}.png`), png);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function runInBatches<T>(
	items: T[],
	batchSize: number,
	fn: (item: T) => Promise<void>,
	bar: cliProgress.SingleBar
): Promise<void> {
	for (let i = 0; i < items.length; i += batchSize) {
		await Promise.all(
			items.slice(i, i + batchSize).map(async (item) => {
				await fn(item);
				bar.increment();
			})
		);
	}
}

async function main(): Promise<void> {
	console.log('📸 Generating OG images…\n');

	const posts = loadAllPosts();

	// Build auteur → posts map
	const auteurPostsMap = new Map<string, PostMeta[]>();
	for (const post of posts) {
		const seen = new Set<string>();
		for (const name of post.auteurs) {
			const key = slugify(name);
			if (seen.has(key)) continue;
			seen.add(key);
			if (!auteurPostsMap.has(key)) auteurPostsMap.set(key, []);
			auteurPostsMap.get(key)!.push(post);
		}
	}
	// Canonical name per slug (first seen)
	const auteurNames = new Map<string, string>();
	for (const post of posts) {
		for (const name of post.auteurs) {
			const key = slugify(name);
			if (!auteurNames.has(key)) auteurNames.set(key, name);
		}
	}

	// Pre-fetch all photos (posts authors + auteurs)
	console.log('  Fetching photos…');
	const allPhotoFiles: string[] = [];
	for (const post of posts) {
		const author = getPostPrimaryAuthor(post.slug);
		if (author?.photo) allPhotoFiles.push(author.photo);
	}
	for (const name of auteurNames.values()) {
		const dep = findDeputeByName(name);
		if (dep?.photo) allPhotoFiles.push(dep.photo);
	}
	await prefetchPhotos(allPhotoFiles);
	console.log(`  ${new Set(allPhotoFiles.filter(Boolean)).size} unique photos cached.\n`);

	const multiBar = new cliProgress.MultiBar(
		{ clearOnComplete: true, hideCursor: true, format: '  {bar} {percentage}% | {value}/{total} | {name}' },
		cliProgress.Presets.shades_classic
	);

	// Home
	process.stdout.write('  Generating home.png… ');
	await generateHome(posts.length);
	console.log('✓\n');

	// Posts
	const postBar = multiBar.create(posts.length, 0, { name: 'posts' });
	await runInBatches(posts, 10, generatePost, postBar);
	multiBar.remove(postBar);

	// Auteurs
	const auteurList = [...auteurNames.entries()];
	const auteurBar = multiBar.create(auteurList.length, 0, { name: 'auteurs' });
	await runInBatches(
		auteurList,
		10,
		([key, name]) => generateAuteur(name, auteurPostsMap.get(key) ?? []),
		auteurBar
	);
	multiBar.remove(auteurBar);

	multiBar.stop();

	console.log(`\n✅ Done — ${posts.length} posts, ${auteurList.length} auteurs, 1 home\n`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
