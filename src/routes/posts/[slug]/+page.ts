import type { PageLoad } from './$types';
import type { Component } from 'svelte';
import { error } from '@sveltejs/kit';
import { postModules } from '$lib/content';

export const load: PageLoad = async ({ params, data }) => {
	const key = Object.keys(postModules).find((k) => k.endsWith(`/${params.slug}.md`));
	if (!key) error(404, 'Proposition introuvable');

	const mod = await postModules[key]();

	return { ...data, component: mod.default as Component };
};
