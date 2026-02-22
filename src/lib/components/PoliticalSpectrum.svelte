<script lang="ts">
	import { normalizeForLookup } from '$lib/utils/normalize';
	import { GROUPE_ORDER } from '$lib/utils/groupe-order';
	import { slide } from 'svelte/transition';

	interface DeputeInput {
		nom: string;
		prenom: string;
		groupeAbrev: string;
	}

	interface GroupeInput {
		abrev: string;
		nom: string;
		couleur: string;
	}

	let {
		auteurs,
		deputes,
		groupes
	}: {
		auteurs: string[];
		deputes: DeputeInput[];
		groupes: GroupeInput[];
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
		const seats = new Map<string, number>();
		for (const dep of deputes) {
			seats.set(dep.groupeAbrev, (seats.get(dep.groupeAbrev) ?? 0) + 1);
		}

		const sigMap = new Map<string, number>();
		for (const auteur of auteurs) {
			const norm = normalizeForLookup(auteur);
			let dep: DeputeInput | undefined;
			// Pass 1: exact full name
			dep = deputes.find((d) => {
				const fullA = normalizeForLookup(`${d.prenom} ${d.nom}`);
				const fullB = normalizeForLookup(`${d.nom} ${d.prenom}`);
				return norm === fullA || norm === fullB;
			});
			// Pass 2: both nom and prenom present
			if (!dep) dep = deputes.find((d) => {
				const n = normalizeForLookup(d.nom);
				const p = normalizeForLookup(d.prenom);
				return n && p && norm.includes(n) && norm.includes(p);
			});
			// Pass 3: nom at end of target only (avoids matching first names used as nom)
			if (!dep) dep = deputes.find((d) => {
				const n = normalizeForLookup(d.nom);
				return n && (norm === n || norm.endsWith(' ' + n));
			});
			if (dep) {
				sigMap.set(dep.groupeAbrev, (sigMap.get(dep.groupeAbrev) ?? 0) + 1);
			}
		}

		return GROUPE_ORDER.flatMap((abrev) => {
			const groupe = groupeMap.get(abrev);
			const totalSeats = seats.get(abrev) ?? 0;
			if (!groupe || totalSeats === 0) return [];
			return [{
				abrev,
				nom: groupe.nom,
				couleur: groupe.couleur,
				totalSeats,
				signataires: sigMap.get(abrev) ?? 0
			} satisfies GroupStat];
		});
	});

	const total = $derived(stats.reduce((sum, s) => sum + s.totalSeats, 0));
	const withSig = $derived(stats.filter((s) => s.signataires > 0));

	let tooltip = $state<{ x: number; y: number; text: string } | null>(null);
	let tableOpen = $state(false);
</script>

<!-- Segmented bar -->
<div class="relative flex h-2 w-full gap-px overflow-hidden rounded-full">
	{#each stats as group}
		{@const widthPct = (group.totalSeats / total) * 100}
		{@const fillPct = (group.signataires / group.totalSeats) * 100}
		<div
			role="presentation"
			class="relative flex-none overflow-hidden rounded-sm"
			style="width: {widthPct}%; background-color: {group.couleur}22;"
			onmouseenter={(e) => {
				const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
				tooltip = {
					x: rect.left + rect.width / 2,
					y: rect.top - 8,
					text: `${group.abrev}: ${group.signataires}/${group.totalSeats}`
				};
			}}
			onmouseleave={() => (tooltip = null)}
		>
			<div
				class="absolute inset-y-0 left-0 rounded-sm"
				style="width: {fillPct}%; background-color: {group.couleur};"
			></div>
		</div>
	{/each}
</div>

{#if tooltip}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background shadow-lg"
		style="left: {tooltip.x}px; top: {tooltip.y}px;"
	>
		{tooltip.text}
	</div>
{/if}

{#if withSig.length > 0}
	<!-- Party table -->
	<div class="mt-5">
		<button
			class="flex w-full cursor-pointer items-center justify-between text-left"
			onclick={() => (tableOpen = !tableOpen)}
		>
			<h3 class="text-xs font-semibold uppercase tracking-widest text-muted-foreground underline decoration-dotted underline-offset-2">
				Répartition par parti
			</h3>
			<svg
				class="h-4 w-4 shrink-0 text-muted-foreground transition-transform {tableOpen ? 'rotate-180' : ''}"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
			</svg>
		</button>
		{#if tableOpen}
			<div transition:slide={{ duration: 200 }} class="mt-3 overflow-hidden rounded-lg border border-border">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border bg-muted/40">
							<th
								class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
							>
								Parti
							</th>
							<th
								class="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
							>
								Signataires
							</th>
							<th
								class="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
							>
								Total
							</th>
						</tr>
					</thead>
					<tbody>
						{#each withSig as group}
							<tr class="border-b border-border last:border-0 transition-colors hover:bg-muted/20">
								<td class="px-4 py-2.5">
									<span class="flex items-center gap-2">
										<span
											class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
											style="background-color: {group.couleur};"
										></span>
										<span class="text-sm text-foreground">{group.nom}</span>
									</span>
								</td>
								<td class="px-4 py-2.5 text-right text-sm font-bold text-foreground">
									{group.signataires}
								</td>
								<td class="px-4 py-2.5 text-right text-sm text-muted-foreground">
									{group.totalSeats}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
{/if}
