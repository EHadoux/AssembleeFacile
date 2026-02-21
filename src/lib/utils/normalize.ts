export function normalizeForLookup(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}
