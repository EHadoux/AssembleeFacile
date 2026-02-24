<script lang="ts">
	import type { PageData } from './$types';
	import PostCard from '$lib/components/PostCard.svelte';
	import { slugify } from '$lib/content';

	let { data }: { data: PageData } = $props();
	let photoErrors = $state<boolean[]>([]);
	$effect.pre(() => {
		photoErrors = data.topContributors.map(() => false);
	});

	let partyTooltip = $state<{ x: number; y: number; text: string } | null>(null);
</script>

<svelte:head>
	<title>Assemblée Facile — Propositions de loi en clair</title>
	<meta name="description" content="Retrouvez les propositions de loi déposées à l'Assemblée nationale, expliquées clairement." />
</svelte:head>

<!-- Hero -->
<section class="border-b border-border/50 bg-white py-12">
	<div class="mx-auto max-w-6xl px-4">
		<div class="max-w-2xl">
			<p class="mb-2 text-xs font-semibold uppercase tracking-widest text-primary opacity-80">
				17e législature
			</p>
			<h1 class="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-foreground">
				Les propositions de loi,<br />
				<span class="text-primary">expliquées clairement.</span>
			</h1>
			<p class="text-base text-muted-foreground">
				{data.totalPosts} propositions de loi déposées à l'Assemblée nationale, résumées et organisées par thématique et auteur.
			</p>
		</div>
	</div>
</section>

<div class="mx-auto max-w-6xl px-4 py-8">
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">

		<!-- Post list -->
		<section>
			<div class="mb-5 flex items-baseline justify-between">
				<h2 class="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
					Dernières propositions
				</h2>
				{#if data.totalPages > 1}
					<a href="/page/2" class="text-xs font-medium text-primary hover:underline">
						Voir plus →
					</a>
				{/if}
			</div>

			<div class="flex flex-col gap-3">
				{#each data.posts as post}
					<PostCard {post} />
				{/each}
			</div>

			{#if data.totalPages > 1}
				<div class="mt-8 flex justify-center">
					<a
						href="/page/2"
						class="rounded-lg border border-border bg-white px-6 py-2.5 text-sm font-medium text-foreground shadow-sm hover:border-primary hover:text-primary transition-colors"
					>
						Page suivante →
					</a>
				</div>
			{/if}
		</section>

		<!-- Sidebar -->
		<aside class="flex flex-col gap-5">
			<div class="rounded-xl border border-border bg-white p-5 shadow-sm">
				<h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					Top contributeurs
				</h3>
				<ol class="flex flex-col gap-3">
					{#each data.topContributors as { name, count, groupeAbrev, couleur, photo }, i}
						<li class="flex items-center gap-3">
							<span class="w-4 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
								{i + 1}
							</span>
							{#if photo && !photoErrors[i]}
								<img
									src="https://www2.assemblee-nationale.fr/static/tribun/17/photos/{photo}"
									alt={name}
									class="h-8 w-8 shrink-0 rounded-full bg-accent object-cover object-top"
									onerror={() => { photoErrors[i] = true; }}
								/>
							{:else}
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-muted-foreground">
									{name.split(' ').pop()?.[0] ?? '?'}
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<a href="/auteurs/{slugify(name)}" class="truncate text-xs font-semibold text-foreground hover:text-primary hover:underline">{name}</a>
								{#if groupeAbrev}
									<span
										class="mt-0.5 inline-block rounded-sm px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
										style="background-color: {couleur ?? '#9ca3af'};"
									>
										{groupeAbrev}
									</span>
								{/if}
							</div>
							<span class="shrink-0 text-xs font-bold tabular-nums text-primary">{count}</span>
						</li>
					{/each}
				</ol>
				<a href="/auteurs" class="mt-4 block text-center text-xs font-medium text-primary hover:underline">
					Tous les auteurs →
				</a>
			</div>

			<div class="rounded-xl border border-border bg-white p-5 shadow-sm">
				<h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					Propositions par groupe
				</h3>
				<div class="flex flex-col gap-2">
					{#each data.partyStats as party}
						{@const max = data.partyStats[0].count}
						<div class="flex items-center gap-2">
							<span
								role="presentation"
								class="w-14 shrink-0 truncate text-[11px] font-medium text-muted-foreground cursor-help underline decoration-dotted underline-offset-2"
								onmouseenter={(e) => {
									const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
									partyTooltip = {
										x: rect.left + rect.width / 2,
										y: rect.top - 8,
										text: party.nom
									};
								}}
								onmouseleave={() => (partyTooltip = null)}
							>
								{party.abrev}
							</span>
							<div class="flex-1 overflow-hidden rounded-full bg-accent" style="height:5px;">
								<div
									class="h-full rounded-full"
									style="width:{(party.count / max) * 100}%; background-color:{party.couleur};"
								></div>
							</div>
							<span class="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-foreground">
								{party.count}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="rounded-xl border border-border bg-white p-5 shadow-sm">
				<h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					Plus cosignées
				</h3>
				<ol class="flex flex-col gap-1">
					{#each data.mostCosigned as { slug, titre_court, nb_cosignataires }, i}
						{@const pct = Math.round((nb_cosignataires / data.totalDeputes) * 100)}
						<li>
							<a
								href="/posts/{slug}"
								class="group -mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60"
							>
								<div class="flex items-start gap-2">
									<span
										class="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-black tabular-nums leading-none transition-colors {i === 0 ? 'bg-primary text-white' : 'bg-accent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}"
									>
										{i + 1}
									</span>
									<span class="flex-1 text-[11px] font-medium leading-snug text-foreground line-clamp-2 transition-colors group-hover:text-primary">
										{titre_court}
									</span>
								</div>
								<div class="ml-6 flex items-center gap-2">
									<div class="h-[3px] flex-1 overflow-hidden rounded-full bg-accent">
										<div
											class="h-full rounded-full transition-all duration-500 {i === 0 ? 'bg-primary' : 'bg-primary/40 group-hover:bg-primary/70'}"
											style="width:{pct}%;"
										></div>
									</div>
									<span class="shrink-0 text-[10px] font-bold tabular-nums text-primary/70">
										{nb_cosignataires}
									</span>
								</div>
							</a>
						</li>
					{/each}
				</ol>
			</div>
			<div class="rounded-xl border border-border bg-white p-5 shadow-sm">
				<h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					Trans-partisanes
				</h3>
				<ol class="flex flex-col gap-1">
					{#each data.mostTransPartisan as { slug, titre_court, nb_groupes, nb_cosignataires, groupes }, i}
						{@const groupSet = new Set(groupes)}
						<li>
							<a
								href="/posts/{slug}"
								class="group -mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60"
							>
								<div class="flex items-start gap-2">
									<span
										class="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-black tabular-nums leading-none transition-colors {i === 0 ? 'bg-primary text-white' : 'bg-accent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}"
									>
										{i + 1}
									</span>
									<span class="flex-1 text-[11px] font-medium leading-snug text-foreground line-clamp-2 transition-colors group-hover:text-primary">
										{titre_court}
									</span>
								</div>
								<div class="ml-6 flex items-center gap-2">
									<div class="flex items-center gap-[3px]">
										{#each data.orderedGroupes as g}
											{@const active = groupSet.has(g.abrev)}
											<span
												role="presentation"
												class="relative flex h-2 w-2 shrink-0 cursor-default items-center justify-center"
												onmouseenter={(e) => {
													const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
													partyTooltip = { x: rect.left + rect.width / 2, y: rect.top - 8, text: g.nom };
												}}
												onmouseleave={() => (partyTooltip = null)}
											>
												{#if active}
													<span class="block h-2 w-2 rounded-full" style="background-color: {g.couleur ?? '#9ca3af'};"></span>
												{:else}
													<span class="block text-[9px] font-black leading-none text-muted-foreground/30">×</span>
												{/if}
											</span>
										{/each}
									</div>
									<span class="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
										{nb_cosignataires} sig.
									</span>
								</div>
							</a>
						</li>
					{/each}
				</ol>
			</div>
		</aside>
	</div>
</div>

{#if partyTooltip}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background shadow-lg"
		style="left: {partyTooltip.x}px; top: {partyTooltip.y}px;"
	>
		{partyTooltip.text}
	</div>
{/if}
