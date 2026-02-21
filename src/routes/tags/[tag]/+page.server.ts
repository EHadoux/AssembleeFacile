import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllTags, getPostsByTag, getTagBySlug, slugify } from '$lib/content';

export const load: PageServerLoad = async ({ params }) => {
	const tag = getTagBySlug(params.tag);
	if (!tag) error(404, 'Thématique introuvable');

	const posts = getPostsByTag(tag);
	return { tag, posts };
};

export function entries() {
	return getAllTags().map(({ tag }) => ({ tag: slugify(tag) }));
}
