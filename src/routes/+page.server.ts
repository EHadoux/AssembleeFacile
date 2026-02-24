import type { PageServerLoad } from './$types';
import { getAllPosts, POSTS_PER_PAGE } from '$lib/server/content';
import { getTopContributors, getPropositionsByGroupe, getMostCosigned, getMostTransPartisan, getDeputeCount } from '$lib/server/queries';
import { getAllGroupes } from '$lib/server/groupes';
import { GROUPE_ORDER } from '$lib/utils/groupe-order';

export const load: PageServerLoad = async () => {
	const all = getAllPosts();
	const posts = all.slice(0, POSTS_PER_PAGE);
	const totalPages = Math.ceil(all.length / POSTS_PER_PAGE);

	const topContributors = getTopContributors(5);
	const partyStats = getPropositionsByGroupe();
	const mostCosigned = getMostCosigned(5);
	const mostTransPartisan = getMostTransPartisan(5);
	const totalDeputes = getDeputeCount();

	const allGroupes = getAllGroupes();
	const orderedGroupes = GROUPE_ORDER
		.map(abrev => allGroupes.find(g => g.abrev === abrev))
		.filter(g => g !== undefined);

	return {
		posts,
		totalPages,
		totalPosts: all.length,
		topContributors,
		partyStats,
		mostCosigned,
		totalDeputes,
		mostTransPartisan,
		orderedGroupes
	};
};
