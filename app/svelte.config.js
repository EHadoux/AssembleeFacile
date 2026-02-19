import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import { parse as parseTOML } from 'smol-toml';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.svx', '.md'],

	preprocess: [
		vitePreprocess(),
		mdsvex({
			extensions: ['.svx', '.md'],
			frontmatter: {
				marker: '+',
				type: 'toml',
				parse: (fm, messages) => {
					try {
						return parseTOML(fm);
					} catch (e) {
						messages.push({ message: String(e) });
					}
				}
			}
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
