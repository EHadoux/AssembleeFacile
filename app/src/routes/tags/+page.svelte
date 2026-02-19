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
		<p class="mt-1 text-sm text-muted-foreground">{data.tags.length} thématiques identifiées.</p>
	</header>

	<div class="flex flex-wrap gap-2">
		{#each data.tags as { tag, count }}
			{@const size = 0.75 + (count / max) * 0.6}
			<a
				href="/tags/{slugify(tag)}"
				class="group inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
				style="font-size: {size}rem;"
			>
				<span class="font-semibold text-foreground group-hover:text-primary transition-colors">
					{tag}
				</span>
				<span class="text-[11px] tabular-nums text-muted-foreground">{count}</span>
			</a>
		{/each}
	</div>
</div>
