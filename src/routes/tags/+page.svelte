<script lang="ts">
	import type { PageData } from './$types';
	import { slugify } from '$lib/content';

	let { data }: { data: PageData } = $props();

	const max = $derived(data.tags[0]?.count ?? 1);
</script>

<svelte:head>
	<title>Thématiques | Assemblée Facile</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
	<header class="mb-8">
		<h1 class="text-2xl font-extrabold tracking-tight text-foreground">Thématiques</h1>
		<p class="mt-1 text-sm text-muted-foreground">Parcourez les {data.tags.length} thématiques.</p>
	</header>

	<div class="flex flex-wrap gap-2">
		{#each data.tags as { tag, count }}
			{@const size = 0.75 + (count / max) * 0.6}
			<a
				href="/tags/{slugify(tag)}"
				class="group inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-100 hover:shadow-md"
				style="font-size: {size}rem;"
			>
				<span class="font-semibold text-amber-900 transition-colors group-hover:text-amber-950">
					{tag}
				</span>
				<span class="text-[11px] tabular-nums text-muted-foreground">{count}</span>
			</a>
		{/each}
	</div>

	{#if data.topTagsPerGroupe.length > 0}
		<div class="mt-10">
			<div class="mb-6 flex items-center gap-3">
				<div class="h-px flex-1 bg-border"></div>
				<h2 class="text-lg font-extrabold tracking-tight text-foreground">
					Thématiques par groupe politique
				</h2>
				<div class="h-px flex-1 bg-border"></div>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.topTagsPerGroupe as groupe}
					{#if groupe.topTags.length > 0}
						<div
							class="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md"
							style="border-left: 4px solid {groupe.couleur};"
						>
							<div class="p-4">
								<span
									class="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wide text-white"
									style="background-color: {groupe.couleur};"
								>
									{groupe.abrev}
								</span>
								<p
									class="mt-1 mb-3 truncate text-[11px] leading-tight text-muted-foreground"
									title={groupe.nom}
								>
									{groupe.nom}
								</p>
								<div class="flex flex-wrap gap-1.5">
									{#each groupe.topTags as tag}
										<a
											href="/tags/{slugify(tag)}"
											class="inline-flex items-center whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
										>
											{tag}
										</a>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>
