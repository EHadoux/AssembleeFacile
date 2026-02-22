<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let photoErrors = $state<Record<string, boolean>>({});
	let search = $state('');
	let visibleGroupCount = $state(1);

	onMount(() => {
		let current = 1;
		const total = data.groupedList.length;
		function renderNext() {
			if (current < total) {
				current++;
				visibleGroupCount = current;
				requestAnimationFrame(renderNext);
			}
		}
		requestAnimationFrame(renderNext);
	});

	const totalAuteurs = $derived(data.groupedList.reduce((acc, g) => acc + g.auteurs.length, 0));

	const filteredGroups = $derived(
		search.trim() === ''
			? data.groupedList
			: data.groupedList
					.map((g) => ({
						...g,
						auteurs: g.auteurs.filter((a) =>
							a.name.toLowerCase().includes(search.toLowerCase())
						)
					}))
					.filter((g) => g.auteurs.length > 0)
	);

	const displayedGroups = $derived(
		search.trim() !== '' ? filteredGroups : filteredGroups.slice(0, visibleGroupCount)
	);
</script>

<svelte:head>
	<title>Auteurs des propositions | Assemblée Facile</title>
	<meta
		name="description"
		content="{totalAuteurs} députés ayant déposé ou co-signé des propositions de loi à l'Assemblée nationale."
	/>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	<!-- Header -->
	<header class="mb-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h1 class="text-2xl font-extrabold tracking-tight text-foreground">Auteurs</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					{totalAuteurs} député(e)s ayant déposé ou co-signé des propositions de loi.
				</p>
			</div>

			<!-- Search -->
			<div class="relative w-full sm:w-56">
				<svg
					class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<input
					bind:value={search}
					type="search"
					placeholder="Filtrer par nom…"
					class="w-full rounded-lg border border-border bg-white py-1.5 pl-8 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
				/>
			</div>
		</div>
	</header>

	<!-- Groups -->
	{#if filteredGroups.length === 0}
		<p class="py-8 text-center text-sm text-muted-foreground">
			Aucun auteur trouvé pour « {search} ».
		</p>
	{:else}
		{#each displayedGroups as groupe}
			<section class="mb-7">
				<!-- Group header -->
				<div class="mb-3 flex items-center gap-2">
					<span
						class="h-2.5 w-2.5 shrink-0 rounded-full"
						style="background-color: {groupe.couleur};"
					></span>
					<h2 class="text-xs font-bold uppercase tracking-widest text-foreground/80">
						{groupe.nom}
					</h2>
					<span class="text-[11px] tabular-nums text-muted-foreground">
						— {groupe.auteurs.length}
					</span>
				</div>

				<!-- Author grid -->
				<div class="grid grid-cols-4 gap-1 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
					{#each groupe.auteurs as auteur}
						<a
							href="/auteurs/{auteur.slug}"
							class="group flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors duration-100 hover:bg-accent/60"
						>
							<!-- Avatar -->
							<div class="relative shrink-0">
								{#if auteur.photo && !photoErrors[auteur.slug]}
									<img
										src="https://www2.assemblee-nationale.fr/static/tribun/17/photos/{auteur.photo}"
										alt={auteur.name}
										loading="lazy"
										class="h-11 w-11 rounded-full bg-accent object-cover object-top"
										style="outline: 2px solid {groupe.couleur}30; outline-offset: 1px;"
										onerror={() => {
											photoErrors[auteur.slug] = true;
										}}
									/>
								{:else}
									<div
										class="flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold text-white"
										style="background-color: {groupe.couleur};"
									>
										{auteur.name
											.split(' ')
											.slice(0, 2)
											.map((w) => w[0])
											.join('')
											.toUpperCase()}
									</div>
								{/if}
								<!-- Count badge -->
								<span
									class="absolute -bottom-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold leading-none text-white"
									style="background-color: {groupe.couleur};"
								>
									{auteur.count}
								</span>
							</div>

							<!-- Name -->
							<span
								class="w-full truncate text-[10.5px] font-semibold leading-tight text-foreground/85 group-hover:text-primary"
							>
								{auteur.name}
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>
