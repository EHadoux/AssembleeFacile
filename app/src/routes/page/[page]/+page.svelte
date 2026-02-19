<script lang="ts">
	import type { PageData } from './$types';
	import PostCard from '$lib/components/PostCard.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Propositions — Page {data.pageNum} | Assemblée Facile</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-lg font-bold text-foreground">
			Propositions de loi
			<span class="ml-2 text-sm font-normal text-muted-foreground">
				— page {data.pageNum}/{data.totalPages}
			</span>
		</h1>
	</div>

	<div class="flex flex-col gap-3">
		{#each data.posts as post}
			<PostCard {post} />
		{/each}
	</div>

	<!-- Pagination -->
	<div class="mt-8 flex items-center justify-between gap-3">
		<a
			href={data.pageNum === 2 ? '/' : `/page/${data.pageNum - 1}`}
			class="rounded-lg border border-border bg-white px-5 py-2 text-sm font-medium hover:border-primary hover:text-primary transition-colors"
		>
			← Précédent
		</a>
		<span class="text-xs text-muted-foreground">
			{data.pageNum} / {data.totalPages}
		</span>
		{#if data.pageNum < data.totalPages}
			<a
				href="/page/{data.pageNum + 1}"
				class="rounded-lg border border-border bg-white px-5 py-2 text-sm font-medium hover:border-primary hover:text-primary transition-colors"
			>
				Suivant →
			</a>
		{:else}
			<div></div>
		{/if}
	</div>
</div>
