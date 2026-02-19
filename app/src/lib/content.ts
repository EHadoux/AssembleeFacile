/**
 * Central content module — the only file using import.meta.glob for markdown posts.
 * Paths are relative to THIS file (app/src/lib/content.ts):
 *   ../../.. = app/ root → ../content/posts = content/posts in parent dir
 *
 * NOT in $lib/server/ so it can be imported in +page.ts files
 * (which run both SSR and client-side).
 */

export interface PostMeta {
	slug: string;
	proposalTitle: string;
	proposalNum: number;
	title: string;
	date: string;
	auteurs: string[];
	tags: string[];
	link: string;
	stepsName: string[];
	stepsDate: string[];
	stepsStatus: string[];
}

// Eager metadata-only: used by listing pages at build time
const rawMetadata = import.meta.glob('../../../content/posts/*.md', {
	eager: true,
	import: 'metadata'
}) as Record<string, Record<string, unknown>>;

// Lazy full-module: used by single post page to get the compiled Svelte component
export const postModules = import.meta.glob('../../../content/posts/*.md') as Record<
	string,
	() => Promise<{ default: unknown; metadata: Record<string, unknown> }>
>;

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
			stepsStatus: (meta?.stepsStatus as string[]) ?? []
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
	const normalized = slugify(name);
	return allPosts.filter((p) => p.auteurs.some((a) => slugify(a) === normalized));
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
	const seen = new Map<string, string>();
	for (const post of allPosts) {
		for (const auteur of post.auteurs) {
			const key = slugify(auteur);
			if (!seen.has(key)) seen.set(key, auteur);
		}
	}
	return [...seen.values()];
}

export function getTopContributors(n: number): { name: string; count: number }[] {
	const counts = new Map<string, { name: string; count: number }>();
	for (const post of allPosts) {
		for (const auteur of post.auteurs) {
			const key = slugify(auteur);
			const existing = counts.get(key);
			if (existing) {
				existing.count++;
			} else {
				counts.set(key, { name: auteur, count: 1 });
			}
		}
	}
	return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, n);
}

export function getAuteurBySlug(slug: string): string | null {
	return getAllAuteurs().find((name) => slugify(name) === slug) ?? null;
}

export function getTagBySlug(slug: string): string | null {
	return getAllTags().find(({ tag }) => slugify(tag) === slug)?.tag ?? null;
}

/** Mirrors Hugo's urlize: lowercase, remove accents, hyphenate spaces, strip non-alpha */
export function slugify(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/[\s_]+/g, '-')
		.replace(/-+/g, '-');
}

export const POSTS_PER_PAGE = 20;
