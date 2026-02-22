import type { PageServerLoad } from './$types';
import { getAllAuteurs, getPostsByAuteur, slugify } from '$lib/server/content';
import { findDeputeByName } from '$lib/server/deputes';
import { getAllGroupes, GROUPE_ORDER } from '$lib/server/groupes';

export const load: PageServerLoad = async () => {
	const groupes = getAllGroupes();
	const groupeMap = new Map(groupes.map((g) => [g.abrev, g]));

	const auteurs = getAllAuteurs().map((name) => {
		const dep = findDeputeByName(name);
		const count = getPostsByAuteur(name).length;
		return {
			name,
			slug: slugify(name),
			count,
			groupeAbrev: dep?.groupeAbrev ?? null,
			photo: dep?.photo ?? null
		};
	});

	// Group by political group
	const byGroupe: Record<string, typeof auteurs> = {};
	const noGroupe: typeof auteurs = [];

	for (const a of auteurs) {
		if (a.groupeAbrev) {
			if (!byGroupe[a.groupeAbrev]) byGroupe[a.groupeAbrev] = [];
			byGroupe[a.groupeAbrev].push(a);
		} else {
			noGroupe.push(a);
		}
	}

	// Sort each group by count desc
	for (const key of Object.keys(byGroupe)) {
		byGroupe[key].sort((a, b) => b.count - a.count);
	}

	const groupedList = GROUPE_ORDER
		.filter((abrev) => byGroupe[abrev]?.length)
		.map((abrev) => ({
			abrev,
			nom: groupeMap.get(abrev)?.nom ?? abrev,
			couleur: groupeMap.get(abrev)?.couleur ?? '#888',
			auteurs: byGroupe[abrev]
		}));

	return { groupedList, noGroupe };
};
