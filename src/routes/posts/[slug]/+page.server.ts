import type { PageServerLoad, EntryGenerator } from './$types';
import { error } from '@sveltejs/kit';
import { getPost, getAllPosts } from '$lib/server/content';
import { getArticleSignataires, getScrutins } from '$lib/server/queries';

export const load: PageServerLoad = ({ params }) => {
	const meta = getPost(params.slug);
	if (!meta) error(404, 'Proposition introuvable');
	return { meta, signataires: getArticleSignataires(params.slug), scrutins: getScrutins(params.slug) };
};

export const entries: EntryGenerator = () => {
	return getAllPosts().map(({ slug }) => ({ slug }));
};
