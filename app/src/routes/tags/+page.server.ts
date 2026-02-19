import type { PageServerLoad } from './$types';
import { getAllTags } from '$lib/content';

export const load: PageServerLoad = async () => {
	return { tags: getAllTags() };
};
