import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.svx'],

	preprocess: [vitePreprocess()],

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			// undefined = full static generation, no SPA fallback
			fallback: undefined,
			precompress: false,
			strict: true
		}),
		prerender: {
			concurrency: 4
		}
	}
};

export default config;
