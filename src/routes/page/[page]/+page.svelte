<script lang="ts">
	import type { PageData } from './$types';
	import PostCard from '$lib/components/PostCard.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let { data }: { data: PageData } = $props();

	function pageUrl(page: number): string {
		return page === 1 ? '/' : `/page/${page}`;
	}
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

	<Pagination pageNum={data.pageNum} totalPages={data.totalPages} {pageUrl} />
</div>
