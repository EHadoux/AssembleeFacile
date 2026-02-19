<script lang="ts">
	import type { PageData } from './$types';
	import PostCard from '$lib/components/PostCard.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { slugify } from '$lib/content';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.name} | Assemblée Facile</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	<!-- Author header -->
	<header class="mb-8 flex items-center gap-5">
		{#if data.dep?.photo}
			<img
				src="https://www.assemblee-nationale.fr/dyn/static/deputes/photos/{data.dep.photo}"
				alt={data.name}
				class="h-20 w-20 shrink-0 rounded-full bg-accent object-cover shadow-sm"
			/>
		{:else}
			<div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-bold text-muted-foreground shadow-sm">
				{data.name.split(' ').at(-1)?.[0] ?? '?'}
			</div>
		{/if}
		<div>
			<h1 class="text-2xl font-extrabold tracking-tight text-foreground">{data.name}</h1>
			{#if data.groupe}
				<p class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
					<span class="inline-block h-2.5 w-2.5 rounded-full" style="background-color: {data.groupe.couleur};"></span>
					{data.groupe.nom}
				</p>
			{/if}
			<p class="mt-0.5 text-sm text-muted-foreground">
				{data.posts.length} proposition{data.posts.length > 1 ? 's' : ''}
			</p>
		</div>
	</header>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_220px]">
		<section>
			<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
				Propositions
			</h2>
			<div class="flex flex-col gap-3">
				{#each data.posts as post}
					<PostCard {post} />
				{/each}
			</div>
		</section>

		<aside>
			{#if data.topTags.length}
				<div class="rounded-xl border border-border bg-white p-5 shadow-sm">
					<h3 class="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
						Thématiques
					</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each data.topTags as { tag, count }}
							<Badge
								variant="secondary"
								class="rounded-full text-xs"
								href="/tags/{slugify(tag)}"
							>
								{tag}
								<span class="ml-1 opacity-60">{count}</span>
							</Badge>
						{/each}
					</div>
				</div>
			{/if}
		</aside>
	</div>
</div>
