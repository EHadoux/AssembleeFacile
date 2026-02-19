<script lang="ts">
	import type { PageData } from './$types';
	import PostCard from '$lib/components/PostCard.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.tag} | Thématiques | Assemblée Facile</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
	<nav class="mb-4 text-xs text-muted-foreground">
		<a href="/tags" class="hover:text-primary">Thématiques</a>
		<span class="mx-1">/</span>
		<span class="text-foreground font-medium">{data.tag}</span>
	</nav>

	<header class="mb-6">
		<h1 class="text-2xl font-extrabold tracking-tight text-foreground">{data.tag}</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{data.posts.length} proposition{data.posts.length > 1 ? 's' : ''}
		</p>
	</header>

	<div class="flex flex-col gap-3">
		{#each data.posts as post}
			<PostCard {post} />
		{/each}
	</div>
</div>
