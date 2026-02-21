<script lang="ts">
	interface Props {
		pageNum: number;
		totalPages: number;
		pageUrl: (page: number) => string;
	}

	let { pageNum, totalPages, pageUrl }: Props = $props();

	type PageItem = { type: 'page'; n: number } | { type: 'ellipsis'; key: string };

	const items = $derived<PageItem[]>(() => {
		if (totalPages <= 1) return [];

		const windowStart = Math.max(1, pageNum - 2);
		const windowEnd = Math.min(totalPages, pageNum + 2);

		const result: PageItem[] = [];

		// First page
		result.push({ type: 'page', n: 1 });

		// Ellipsis after 1 if gap
		if (windowStart > 2) result.push({ type: 'ellipsis', key: 'start' });

		// Window pages (excluding 1 and totalPages to avoid duplicates)
		for (let i = Math.max(2, windowStart); i <= Math.min(totalPages - 1, windowEnd); i++) {
			result.push({ type: 'page', n: i });
		}

		// Ellipsis before last if gap
		if (windowEnd < totalPages - 1) result.push({ type: 'ellipsis', key: 'end' });

		// Last page (if more than 1 page)
		if (totalPages > 1) result.push({ type: 'page', n: totalPages });

		return result;
	});
</script>

<nav class="mt-8 grid grid-cols-[auto_1fr_auto] items-center gap-2" aria-label="Pagination">
	{#if pageNum > 1}
		<a
			href={pageUrl(pageNum - 1)}
			class="rounded-lg border border-border bg-white px-6 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
		>
			← Précédent
		</a>
	{:else}
		<span class="rounded-lg border border-border/40 bg-white px-6 py-2.5 text-sm font-medium text-muted-foreground/40 shadow-sm cursor-not-allowed select-none">
			← Précédent
		</span>
	{/if}

	<div class="flex items-center justify-center gap-1.5">
		{#each items() as item}
			{#if item.type === 'ellipsis'}
				<span class="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground select-none">
					…
				</span>
			{:else}
				<a
					href={pageUrl(item.n)}
					class="flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors
						{item.n === pageNum
						? 'bg-primary text-white shadow-sm'
						: 'border border-border bg-white text-foreground hover:border-primary hover:text-primary'}"
					aria-current={item.n === pageNum ? 'page' : undefined}
				>
					{item.n}
				</a>
			{/if}
		{/each}
	</div>

	{#if pageNum < totalPages}
		<a
			href={pageUrl(pageNum + 1)}
			class="rounded-lg border border-border bg-white px-6 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
		>
			Suivant →
		</a>
	{:else}
		<span class="rounded-lg border border-border/40 bg-white px-6 py-2.5 text-sm font-medium text-muted-foreground/40 shadow-sm cursor-not-allowed select-none">
			Suivant →
		</span>
	{/if}
</nav>
