import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllAuteurs, getPostsByAuteur, getAuteurBySlug, slugify } from '$lib/content';
import { getAllGroupes } from '$lib/server/groupes';
import { findDeputeByNameInDb, getTopCosignataires } from '$lib/server/queries';

export const load: PageServerLoad = async ({ params }) => {
	const name = getAuteurBySlug(params.slug);
	if (!name) error(404, 'Auteur introuvable');

	const posts = getPostsByAuteur(name);
	const totalPosts = posts.length;

	const dep = findDeputeByNameInDb(name);
	const groupes = getAllGroupes();
	const groupe = dep ? (groupes.find((g) => g.abrev === dep.groupe_abrev) ?? null) : null;
	const cosignataires = dep ? getTopCosignataires(dep.id, 5) : [];

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

	return { name, posts, totalPosts, dep, groupe, topTags, cosignataires };
};

export function entries() {
	return getAllAuteurs().map((name) => ({ slug: slugify(name) }));
}
