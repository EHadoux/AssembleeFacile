import type { RequestHandler } from './$types';
import { getAllPosts } from '$lib/server/content';
import { getAllArticleRoles } from '$lib/server/queries';
import { json } from '@sveltejs/kit';

export const prerender = true;

export const GET: RequestHandler = () => {
	const roles = getAllArticleRoles();
	const posts = getAllPosts().map(({ slug, proposalTitle, proposalNum, auteurs, tags, date }) => {
		const r = roles.get(slug);
		return {
			slug,
			proposalTitle,
			proposalNum,
			auteursPrincipaux: r?.auteursPrincipaux ?? auteurs,
			cosignataires: r?.cosignataires ?? [],
			tags,
			date
		};
	});
	return json(posts);
};
