import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllAuteurs, getPostsByAuteur, getAuteurBySlug, slugify, getAllTags } from '$lib/content';
import { findDeputeByName } from '$lib/server/deputes';
import { getAllGroupes } from '$lib/server/groupes';

export const load: PageServerLoad = async ({ params }) => {
	const name = getAuteurBySlug(params.slug);
	if (!name) error(404, 'Auteur introuvable');

	const posts = getPostsByAuteur(name);
	const dep = findDeputeByName(name);
	const groupes = getAllGroupes();
	const groupe = groupes.find((g) => g.abrev === dep?.groupeAbrev) ?? null;

	// Tag frequency for this author
	const tagCounts = new Map<string, { tag: string; count: number }>();
	for (const post of posts) {
		for (const tag of post.tags) {
			const key = slugify(tag);
			const ex = tagCounts.get(key);
			if (ex) ex.count++;
			else tagCounts.set(key, { tag, count: 1 });
		}
	}
	const topTags = [...tagCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);

	return { name, posts, dep, groupe, topTags };
};

export function entries() {
	return getAllAuteurs().map((name) => ({ slug: slugify(name) }));
}
