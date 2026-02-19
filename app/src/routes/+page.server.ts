import type { PageServerLoad } from './$types';
import { getAllPosts, getTopContributors, POSTS_PER_PAGE } from '$lib/content';
import { getAllDeputes, findDeputeByName } from '$lib/server/deputes';
import { getAllGroupes } from '$lib/server/groupes';

export const load: PageServerLoad = async () => {
	const all = getAllPosts();
	const posts = all.slice(0, POSTS_PER_PAGE);
	const totalPages = Math.ceil(all.length / POSTS_PER_PAGE);

	const topContributors = getTopContributors(5).map((c) => {
		const dep = findDeputeByName(c.name);
		return { ...c, groupeAbrev: dep?.groupeAbrev ?? null, photo: dep?.photo ?? null };
	});

	// Party stats across all posts/auteurs
	const deputes = getAllDeputes();
	const groupes = getAllGroupes();
	const partyCounts = new Map<string, number>();
	for (const post of all) {
		for (const auteur of post.auteurs) {
			const dep = findDeputeByName(auteur);
			if (dep) {
				partyCounts.set(dep.groupeAbrev, (partyCounts.get(dep.groupeAbrev) ?? 0) + 1);
			}
		}
	}
	const partyStats = groupes
		.map((g) => ({ abrev: g.abrev, nom: g.nom, couleur: g.couleur, count: partyCounts.get(g.abrev) ?? 0 }))
		.filter((p) => p.count > 0)
		.sort((a, b) => b.count - a.count);

	return {
		posts,
		totalPages,
		totalPosts: all.length,
		topContributors,
		partyStats,
		deputes,
		groupes
	};
};
