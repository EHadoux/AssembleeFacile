<script lang="ts">
	import { onMount } from 'svelte';
	import Fuse from 'fuse.js';
	import { Input } from '$lib/components/ui/input';
	import PostCard from '$lib/components/PostCard.svelte';
	import { Search } from '@lucide/svelte';
	import type { PostMeta } from '$lib/content';

	type SearchItem = Pick<PostMeta, 'slug' | 'proposalTitle' | 'proposalNum' | 'tags' | 'date'> & {
		auteursPrincipaux: string[];
		cosignataires: string[];
	};

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
			auteurs: [...item.auteursPrincipaux, ...item.cosignataires],
			title: item.proposalTitle,
			link: '',
			stepsName: [],
			stepsDate: [],
			stepsStatus: [],
			excerpt: ''
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
					{ name: 'auteursPrincipaux', weight: 1.2 },
					{ name: 'cosignataires', weight: 0.5 }
				],
				threshold: 0.35,
				ignoreLocation: true,
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
			<Search class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
		<div class="flex flex-col gap-3" aria-busy="true" aria-label="Chargement des propositions">
			{#each [0, 1, 2, 3, 4] as _}
				<div class="animate-pulse rounded-xl border border-border bg-card p-5 shadow-sm">
					<div class="mb-3 h-4 w-3/4 rounded-md bg-accent"></div>
					<div class="mb-4 h-3 w-1/3 rounded-md bg-accent"></div>
					<div class="border-t border-border/50 pt-3">
						<div class="h-3 w-1/4 rounded-full bg-accent"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if query.trim() === ''}
		<p class="text-sm text-muted-foreground">
			Recherchez parmi {allItems.length} propositions de loi.
		</p>
	{:else if resultPosts.length === 0}
		<p class="text-sm text-muted-foreground">
			Aucun résultat pour « {query} ». Essayez un autre mot, ou
			<a href="/tags" class="text-primary hover:underline">parcourez les thématiques</a>.
		</p>
	{:else}
		<p class="mb-4 text-xs text-muted-foreground">{resultPosts.length} résultat{resultPosts.length > 1 ? 's' : ''}</p>
		<div class="flex flex-col gap-3">
			{#each resultPosts as post, i}
				<PostCard {post} delay={i * 35} />
			{/each}
		</div>
	{/if}
</div>
