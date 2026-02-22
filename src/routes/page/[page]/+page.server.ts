import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllPosts, POSTS_PER_PAGE } from '$lib/server/content';

export const load: PageServerLoad = async ({ params }) => {
	const pageNum = parseInt(params.page, 10);
	const all = getAllPosts();
	const totalPages = Math.ceil(all.length / POSTS_PER_PAGE);

	if (isNaN(pageNum) || pageNum < 2 || pageNum > totalPages) {
		error(404, 'Page introuvable');
	}

	const start = (pageNum - 1) * POSTS_PER_PAGE;
	const posts = all.slice(start, start + POSTS_PER_PAGE);

	return { posts, pageNum, totalPages, totalPosts: all.length };
};

export function entries() {
	const all = getAllPosts();
	const totalPages = Math.ceil(all.length / POSTS_PER_PAGE);
	return Array.from({ length: totalPages - 1 }, (_, i) => ({ page: String(i + 2) }));
}
