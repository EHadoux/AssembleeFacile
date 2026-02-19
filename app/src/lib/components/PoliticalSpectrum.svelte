<script lang="ts">
	import type { Depute } from '$lib/server/deputes';
	import { normalizeForLookup } from '$lib/server/deputes';
	import type { Groupe } from '$lib/server/groupes';
	import { GROUPE_ORDER } from '$lib/server/groupes';

	let {
		auteurs,
		deputes,
		groupes,
		totalDeputeCount
	}: {
		auteurs: string[];
		deputes: Depute[];
		groupes: Groupe[];
		totalDeputeCount: number;
	} = $props();

	interface GroupStat {
		abrev: string;
		nom: string;
		couleur: string;
		totalSeats: number;
		signataires: number;
	}

	const groupeMap = $derived(new Map(groupes.map((g) => [g.abrev, g])));

	const stats = $derived.by(() => {
		// Count total seats per group
		const seats = new Map<string, number>();
		for (const dep of deputes) {
			seats.set(dep.groupeAbrev, (seats.get(dep.groupeAbrev) ?? 0) + 1);
		}

		// Match auteurs to deputes
		const sigMap = new Map<string, number>();
		for (const auteur of auteurs) {
			const norm = normalizeForLookup(auteur);
			const dep = deputes.find((d) => {
				const fullA = normalizeForLookup(`${d.prenom} ${d.nom}`);
				const fullB = normalizeForLookup(`${d.nom} ${d.prenom}`);
				return norm === fullA || norm === fullB || norm.includes(normalizeForLookup(d.nom));
			});
			if (dep) {
				sigMap.set(dep.groupeAbrev, (sigMap.get(dep.groupeAbrev) ?? 0) + 1);
			}
		}

		return GROUPE_ORDER.map((abrev) => {
			const groupe = groupeMap.get(abrev);
			if (!groupe) return null;
			return {
				abrev,
				nom: groupe.nom,
				couleur: groupe.couleur,
				totalSeats: seats.get(abrev) ?? 0,
				signataires: sigMap.get(abrev) ?? 0
			} satisfies GroupStat;
		}).filter((s): s is GroupStat => s !== null && s.totalSeats > 0);
	});

	const total = $derived(stats.reduce((sum, s) => sum + s.totalSeats, 0));
	const withSig = $derived(stats.filter((s) => s.signataires > 0));
</script>

<!-- Segmented bar -->
<div class="flex h-4 w-full overflow-hidden rounded-full gap-px">
	{#each stats as group}
		{@const widthPct = (group.totalSeats / total) * 100}
		{@const fillPct = (group.signataires / group.totalSeats) * 100}
		<div
			class="relative flex-none overflow-hidden rounded-sm"
			style="width: {widthPct}%; background-color: {group.couleur}22;"
			title="{group.abrev}: {group.signataires}/{group.totalSeats} signataires"
		>
			<div
				class="absolute inset-y-0 left-0 rounded-sm"
				style="width: {fillPct}%; background-color: {group.couleur};"
			></div>
		</div>
	{/each}
</div>

<!-- Legend row -->
<div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
	{#each withSig as group}
		<span class="flex items-center gap-1 text-[11px] text-muted-foreground">
			<span class="inline-block h-2 w-2 rounded-full shrink-0" style="background-color: {group.couleur};"></span>
			<span class="font-medium">{group.abrev}</span>
			<span class="opacity-70">{group.signataires}</span>
		</span>
	{/each}
</div>
