import type { LayoutServerLoad } from './$types';
import { getAllDeputes } from '$lib/server/deputes';
import { getAllGroupes } from '$lib/server/groupes';

export const load: LayoutServerLoad = () => {
	return {
		deputes: getAllDeputes(),
		groupes: getAllGroupes()
	};
};
