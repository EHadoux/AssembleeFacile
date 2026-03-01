<script lang="ts">
	interface Props {
		pageNum: number;
		totalPages: number;
		pageUrl?: (page: number) => string;
		onPageChange?: (page: number) => void;
	}

	let { pageNum, totalPages, pageUrl, onPageChange }: Props = $props();

	type PageItem = { type: 'page'; n: number } | { type: 'ellipsis'; key: string };

	const items = $derived.by<PageItem[]>(() => {
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

<nav class="mt-8 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2" aria-label="Pagination">
	{#if pageNum > 1}
		{#if onPageChange}
			<button
				onclick={() => onPageChange(pageNum - 1)}
				class="rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary sm:px-6"
			>
				←<span class="hidden sm:inline"> Précédent</span>
			</button>
		{:else}
			<a
				href={pageUrl!(pageNum - 1)}
				class="rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary sm:px-6"
			>
				←<span class="hidden sm:inline"> Précédent</span>
			</a>
		{/if}
	{:else}
		<span class="rounded-lg border border-border/40 bg-white px-3 py-2.5 text-sm font-medium text-muted-foreground/40 shadow-sm cursor-not-allowed select-none sm:px-6">
			←<span class="hidden sm:inline"> Précédent</span>
		</span>
	{/if}

	<div class="flex items-center justify-center gap-1 sm:gap-1.5 overflow-x-auto">
		{#each items as item}
			{#if item.type === 'ellipsis'}
				<span class="flex h-7 w-7 items-center justify-center text-sm text-muted-foreground select-none sm:h-9 sm:w-9">
					…
				</span>
			{:else if onPageChange}
				<button
					onclick={() => onPageChange(item.n)}
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors sm:h-9 sm:w-9 sm:text-sm
						{item.n === pageNum
						? 'bg-primary text-white shadow-sm'
						: 'border border-border bg-white text-foreground hover:border-primary hover:text-primary'}"
					aria-current={item.n === pageNum ? 'page' : undefined}
				>
					{item.n}
				</button>
			{:else}
				<a
					href={pageUrl!(item.n)}
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors sm:h-9 sm:w-9 sm:text-sm
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
		{#if onPageChange}
			<button
				onclick={() => onPageChange(pageNum + 1)}
				class="rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary sm:px-6"
			>
				<span class="hidden sm:inline">Suivant </span>→
			</button>
		{:else}
			<a
				href={pageUrl!(pageNum + 1)}
				class="rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary sm:px-6"
			>
				<span class="hidden sm:inline">Suivant </span>→
			</a>
		{/if}
	{:else}
		<span class="rounded-lg border border-border/40 bg-white px-3 py-2.5 text-sm font-medium text-muted-foreground/40 shadow-sm cursor-not-allowed select-none sm:px-6">
			<span class="hidden sm:inline">Suivant </span>→
		</span>
	{/if}
</nav>
