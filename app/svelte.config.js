import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Treat .svx files (mdsvex markdown) as Svelte components
	extensions: ['.svelte', '.svx', '.md'],

	preprocess: [
		vitePreprocess(),
		mdsvex({
			extensions: ['.svx', '.md']
		})
	],

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			// undefined = full static generation, no SPA fallback
			fallback: undefined,
			precompress: false,
			strict: true
		})
	}
};

export default config;
