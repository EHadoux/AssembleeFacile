import type { PageServerLoad, EntryGenerator } from './$types';
import { error } from '@sveltejs/kit';
import { getPost, getAllPosts } from '$lib/server/content';

export const load: PageServerLoad = ({ params }) => {
	const meta = getPost(params.slug);
	if (!meta) error(404, 'Proposition introuvable');
	return { meta };
};

export const entries: EntryGenerator = () => {
	return getAllPosts().map(({ slug }) => ({ slug }));
};
