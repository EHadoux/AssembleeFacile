/**
 * Server-only content module.
 * Contains all eager markdown imports — kept server-side so the client bundle
 * only sees lazy postModules (code-split per post) from $lib/content.ts.
 */

import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { PostMeta } from '$lib/content';
import { slugify, POSTS_PER_PAGE } from '$lib/content';

const db = new DatabaseSync(join(process.cwd(), 'db/assemblee.db'));
export { slugify, POSTS_PER_PAGE };
export type { PostMeta };

const rawMetadata = import.meta.glob('../../../content/posts/*.md', {
	eager: true,
	import: 'metadata'
}) as Record<string, Record<string, unknown>>;

const rawContent = import.meta.glob('../../../content/posts/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

function extractExcerpt(raw: string, maxChars = 200): string {
	const match = raw.match(/## Résumé\s*\n+([\s\S]+?)(?=\n+##|$)/);
	if (!match) return '';
	const text = match[1].replace(/\*\*/g, '').replace(/\*/g, '').trim();
	return text.length > maxChars ? text.slice(0, maxChars).trimEnd() + '…' : text;
}

const allPosts: PostMeta[] = Object.entries(rawMetadata)
	.map(([path, meta]) => {
		const slug = path.split('/').pop()!.replace('.md', '');
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
			title: rawTitle,
			date,
			auteurs: (meta?.auteurs as string[]) ?? [],
			tags: (meta?.tags as string[]) ?? [],
			link: (meta?.link as string) ?? '',
			stepsName: (meta?.stepsName as string[]) ?? [],
			stepsDate: (meta?.stepsDate as string[]) ?? [],
			stepsStatus: (meta?.stepsStatus as string[]) ?? [],
			excerpt: extractExcerpt(rawContent[path] ?? '')
		} satisfies PostMeta;
	})
	.sort((a, b) => b.proposalNum - a.proposalNum);

export function getAllPosts(): PostMeta[] {
	return allPosts;
}

export function getPost(slug: string): PostMeta | null {
	return allPosts.find((p) => p.slug === slug) ?? null;
}

export function getPostsByTag(tag: string): PostMeta[] {
	const normalized = slugify(tag);
	return allPosts.filter((p) => p.tags.some((t) => slugify(t) === normalized));
}

export function getPostsByAuteur(name: string): PostMeta[] {
	const idRow = db
		.prepare(
			'SELECT depute_id FROM article_auteurs WHERE nom_brut = ? AND depute_id IS NOT NULL LIMIT 1'
		)
		.get(name) as { depute_id: string } | undefined;

	const slugRows = idRow?.depute_id
		? (db
				.prepare('SELECT DISTINCT article_slug FROM article_auteurs WHERE depute_id = ?')
				.all(idRow.depute_id) as { article_slug: string }[])
		: (db
				.prepare('SELECT DISTINCT article_slug FROM article_auteurs WHERE nom_brut = ?')
				.all(name) as { article_slug: string }[]);

	const slugSet = new Set(slugRows.map((r) => r.article_slug));
	return allPosts.filter((p) => slugSet.has(p.slug));
}

export function getAllTags(): { tag: string; count: number }[] {
	const counts = new Map<string, { tag: string; count: number }>();
	for (const post of allPosts) {
		for (const tag of post.tags) {
			const key = slugify(tag);
			const existing = counts.get(key);
			if (existing) {
				existing.count++;
			} else {
				counts.set(key, { tag, count: 1 });
			}
		}
	}
	return [...counts.values()].sort((a, b) => b.count - a.count);
}

export function getAllAuteurs(): string[] {
	const rows = db
		.prepare('SELECT DISTINCT nom_brut FROM article_auteurs ORDER BY nom_brut')
		.all() as { nom_brut: string }[];
	const seen = new Map<string, string>();
	for (const { nom_brut } of rows) {
		const key = slugify(nom_brut);
		if (!seen.has(key)) seen.set(key, nom_brut);
	}
	return [...seen.values()];
}

export function getAuteurBySlug(slug: string): string | null {
	return getAllAuteurs().find((name) => slugify(name) === slug) ?? null;
}

export function getTagBySlug(slug: string): string | null {
	return getAllTags().find(({ tag }) => slugify(tag) === slug)?.tag ?? null;
}
