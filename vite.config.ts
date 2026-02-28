import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { parse as parseTOML } from 'smol-toml';
import { marked } from 'marked';

function markdownPlugin(): Plugin {
	return {
		name: 'markdown-to-html',
		transform(code, id) {
			if (!id.endsWith('.md') || id.includes('?')) return;

			const match = code.match(/^\+{3}\r?\n([\s\S]*?)\r?\n\+{3}\r?\n([\s\S]*)$/);
			if (!match) return;

			const [, fm, body] = match;
			const metadata = parseTOML(fm);
			const html = marked(body) as string;

			return {
				code: `export const metadata = ${JSON.stringify(metadata)};\nexport default ${JSON.stringify(html)};`,
				map: null
			};
		}
	};
}

export default defineConfig({
	plugins: [tailwindcss(), markdownPlugin(), sveltekit()],
	server: {
		fs: { allow: ['.'] }
	}
});
