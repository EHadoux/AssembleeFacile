import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllAuteurs, getPostsByAuteur, getAuteurBySlug, slugify } from '$lib/content';
import { getAllGroupes } from '$lib/server/groupes';
import { findDeputeByNameInDb, getTopCosignataires } from '$lib/server/queries';

const AUTEUR_PER_PAGE = 10;

export const load: PageServerLoad = async ({ params, url }) => {
	const name = getAuteurBySlug(params.slug);
	if (!name) error(404, 'Auteur introuvable');

	const allPosts = getPostsByAuteur(name);
	const totalPosts = allPosts.length;
	const totalPages = Math.ceil(totalPosts / AUTEUR_PER_PAGE);

	const pageNum = Math.max(1, Math.min(parseInt(url.searchParams.get('page') ?? '1', 10) || 1, totalPages));
	const start = (pageNum - 1) * AUTEUR_PER_PAGE;
	const posts = allPosts.slice(start, start + AUTEUR_PER_PAGE);

	const dep = findDeputeByNameInDb(name);
	const groupes = getAllGroupes();
	const groupe = dep ? (groupes.find((g) => g.abrev === dep.groupe_abrev) ?? null) : null;
	const cosignataires = dep ? getTopCosignataires(dep.id, 5) : [];

	const tagCounts = new Map<string, { tag: string; count: number }>();
	for (const post of allPosts) {
		for (const tag of post.tags) {
			const key = slugify(tag);
			const ex = tagCounts.get(key);
			if (ex) ex.count++;
			else tagCounts.set(key, { tag, count: 1 });
		}
	}
	const topTags = [...tagCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);

	return { name, posts, totalPosts, totalPages, pageNum, dep, groupe, topTags, cosignataires };
};

export function entries() {
	return getAllAuteurs().map((name) => ({ slug: slugify(name) }));
}
