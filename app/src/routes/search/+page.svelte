<script lang="ts">
	import { onMount } from 'svelte';
	import Fuse from 'fuse.js';
	import { Input } from '$lib/components/ui/input';
	import PostCard from '$lib/components/PostCard.svelte';
	import type { PostMeta } from '$lib/content';

	type SearchItem = Pick<PostMeta, 'slug' | 'proposalTitle' | 'proposalNum' | 'auteurs' | 'tags' | 'date'>;

	let query = $state('');
	let allItems = $state<SearchItem[]>([]);
	let fuse = $state<Fuse<SearchItem> | null>(null);
	let loading = $state(true);

	const results = $derived.by(() => {
		if (!fuse || !query.trim()) return [];
		return fuse.search(query.trim(), { limit: 30 }).map((r) => r.item);
	});

	// Build full PostMeta-compatible objects for PostCard
	const resultPosts = $derived(
		results.map((item) => ({
			...item,
			title: item.proposalTitle,
			link: '',
			stepsName: [],
			stepsDate: [],
			stepsStatus: []
		})) satisfies PostMeta[]
	);

	onMount(async () => {
		try {
			const res = await fetch('/search.json');
			allItems = await res.json();
			fuse = new Fuse(allItems, {
				keys: [
					{ name: 'proposalTitle', weight: 2 },
					{ name: 'tags', weight: 1.5 },
					{ name: 'auteurs', weight: 1 }
				],
				threshold: 0.35,
				includeScore: true
			});
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Recherche | Assemblée Facile</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
	<header class="mb-8">
		<h1 class="mb-4 text-2xl font-extrabold tracking-tight text-foreground">Rechercher</h1>
		<div class="relative">
			<span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
				🔍
			</span>
			<Input
				type="search"
				placeholder="Titre, auteur, thématique…"
				bind:value={query}
				class="pl-10 h-12 text-base rounded-xl border-border shadow-sm focus-visible:ring-primary"
				autofocus
			/>
		</div>
	</header>

	{#if loading}
		<p class="text-sm text-muted-foreground">Chargement de l'index…</p>
	{:else if query.trim() === ''}
		<p class="text-sm text-muted-foreground">
			{allItems.length} propositions dans l'index. Tapez pour rechercher.
		</p>
	{:else if resultPosts.length === 0}
		<p class="text-sm text-muted-foreground">Aucun résultat pour « {query} ».</p>
	{:else}
		<p class="mb-4 text-xs text-muted-foreground">{resultPosts.length} résultat{resultPosts.length > 1 ? 's' : ''}</p>
		<div class="flex flex-col gap-3">
			{#each resultPosts as post}
				<PostCard {post} />
			{/each}
		</div>
	{/if}
</div>
