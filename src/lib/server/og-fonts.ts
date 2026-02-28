import type { SatoriOptions } from 'satori';
import { readFileSync } from 'node:fs';

type FontInput = NonNullable<SatoriOptions['fonts']>[number];

// Read once at module load — Node module cache ensures a single read per build process.
function loadFont(weight: number): FontInput {
	const path = `node_modules/@fontsource/dm-sans/files/dm-sans-latin-${weight}-normal.woff`;
	const data = readFileSync(path).buffer;
	return { name: 'DM Sans', data, weight, style: 'normal' };
}

let cache: FontInput[] | null = null;

export function getOgFonts(): FontInput[] {
	if (cache) return cache;
	cache = [400, 700, 800].map(loadFont);
	return cache;
}
