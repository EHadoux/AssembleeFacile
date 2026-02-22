import type { PageLoad } from './$types';
import type { Component } from 'svelte';
import { error } from '@sveltejs/kit';
import { getPost, postModules } from '$lib/content';

export const load: PageLoad = ({ params }) => {
	const meta = getPost(params.slug);
	if (!meta) error(404, 'Proposition introuvable');

	const key = Object.keys(postModules).find((k) => k.endsWith(`/${params.slug}.md`));
	if (!key) error(404, 'Proposition introuvable');

	const mod = postModules[key];

	return { meta, component: mod.default as Component };
};

// Tell SvelteKit which slugs to prerender
export function entries() {
	return Object.keys(postModules).map((path) => ({
		slug: path.split('/').pop()!.replace('.md', '')
	}));
}
