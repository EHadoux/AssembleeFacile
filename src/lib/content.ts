/**
 * Universal content module (runs on both server and client).
 * Contains only: PostMeta type, slugify, POSTS_PER_PAGE, and lazy postModules.
 *
 * All eager markdown imports (metadata, raw text, allPosts, etc.) live in
 * $lib/server/content.ts to avoid bloating the client bundle.
 *
 * postModules is lazy so each post's compiled Svelte component is code-split
 * into its own chunk and only downloaded when navigating to that post.
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
	excerpt: string;
}

export const postModules = import.meta.glob('../../content/posts/*.md') as Record<
	string,
	() => Promise<{ default: string }>
>;

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

export const POSTS_PER_PAGE = 10;
