<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Auteurs des propositions | Assemblée Facile</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	<header class="mb-8">
		<h1 class="text-2xl font-extrabold tracking-tight text-foreground">Auteurs</h1>
		<p class="mt-1 text-sm text-muted-foreground">Députés ayant déposé ou co-signé des propositions de loi.</p>
	</header>

	{#each data.groupedList as groupe}
		<section class="mb-10">
			<div class="mb-4 flex items-center gap-2">
				<span class="h-3 w-3 rounded-full shrink-0" style="background-color: {groupe.couleur};"></span>
				<h2 class="text-sm font-semibold text-foreground">{groupe.nom}</h2>
				<span class="text-xs text-muted-foreground">— {groupe.auteurs.length} auteurs</span>
			</div>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each groupe.auteurs as auteur}
					<a
						href="/auteurs/{auteur.slug}"
						class="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-white p-3 text-center shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
					>
						{#if auteur.photo}
							<img
								src="https://www.assemblee-nationale.fr/dyn/static/deputes/photos/{auteur.photo}"
								alt={auteur.name}
								class="h-14 w-14 rounded-full bg-accent object-cover"
								onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
							/>
						{:else}
							<div class="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-muted-foreground">
								{auteur.name.split(' ').at(-1)?.[0] ?? '?'}
							</div>
						{/if}
						<span class="text-xs font-semibold leading-tight text-foreground">{auteur.name}</span>
						<span class="text-[10px] tabular-nums text-muted-foreground">{auteur.count} prop.</span>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</div>
