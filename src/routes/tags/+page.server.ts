import type { PageServerLoad } from './$types';
import { getAllTags, getAllPosts } from '$lib/content';
import { getAllDeputes } from '$lib/server/deputes';
import { getAllGroupes } from '$lib/server/groupes';
import { normalizeForLookup } from '$lib/utils/normalize';
import { GROUPE_ORDER } from '$lib/utils/groupe-order';

export const load: PageServerLoad = async () => {
	const tags = getAllTags();
	const posts = getAllPosts();
	const deputes = getAllDeputes();
	const groupes = getAllGroupes();

	// Build efficient lookup: normalised full name → groupeAbrev
	const nameToGroupe = new Map<string, string>();
	for (const d of deputes) {
		nameToGroupe.set(normalizeForLookup(`${d.prenom} ${d.nom}`), d.groupeAbrev);
		nameToGroupe.set(normalizeForLookup(`${d.nom} ${d.prenom}`), d.groupeAbrev);
	}

	function findGroupe(auteur: string): string | undefined {
		const norm = normalizeForLookup(auteur);
		if (nameToGroupe.has(norm)) return nameToGroupe.get(norm);
		// Fallback: match by nom only
		for (const d of deputes) {
			if (norm.includes(normalizeForLookup(d.nom))) return d.groupeAbrev;
		}
		return undefined;
	}

	// Count tags per groupe
	const tagCounts = new Map<string, Map<string, number>>();
	for (const post of posts) {
		for (const auteur of post.auteurs) {
			const groupeAbrev = findGroupe(auteur);
			if (!groupeAbrev) continue;
			const groupeTags = tagCounts.get(groupeAbrev) ?? new Map<string, number>();
			for (const tag of post.tags) {
				groupeTags.set(tag, (groupeTags.get(tag) ?? 0) + 1);
			}
			tagCounts.set(groupeAbrev, groupeTags);
		}
	}

	const groupeMap = new Map(groupes.map((g) => [g.abrev, g]));
	const topTagsPerGroupe = GROUPE_ORDER.flatMap((abrev) => {
		const groupe = groupeMap.get(abrev);
		const counts = tagCounts.get(abrev);
		if (!groupe || !counts?.size) return [];
		const topTags = [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([tag]) => tag);
		if (!topTags.length) return [];
		return [{ abrev, nom: groupe.nom, couleur: groupe.couleur, topTags }];
	});

	return { tags, topTagsPerGroupe };
};
