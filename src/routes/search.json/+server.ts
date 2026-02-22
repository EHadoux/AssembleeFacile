import type { RequestHandler } from './$types';
import { getAllPosts } from '$lib/server/content';
import { json } from '@sveltejs/kit';

export const prerender = true;

export const GET: RequestHandler = () => {
	const posts = getAllPosts().map(({ slug, proposalTitle, proposalNum, auteurs, tags, date }) => ({
		slug,
		proposalTitle,
		proposalNum,
		auteurs,
		tags,
		date
	}));
	return json(posts);
};
