import type { PageServerLoad } from './$types';
import { getAllPosts, POSTS_PER_PAGE } from '$lib/server/content';
import { getTopContributors, getPropositionsByGroupe } from '$lib/server/queries';

export const load: PageServerLoad = async () => {
	const all = getAllPosts();
	const posts = all.slice(0, POSTS_PER_PAGE);
	const totalPages = Math.ceil(all.length / POSTS_PER_PAGE);

	const topContributors = getTopContributors(5);
	const partyStats = getPropositionsByGroupe();

	return {
		posts,
		totalPages,
		totalPosts: all.length,
		topContributors,
		partyStats
	};
};
