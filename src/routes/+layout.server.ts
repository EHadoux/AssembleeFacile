import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	const buildDate = new Date().toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
	return { buildDate };
};
