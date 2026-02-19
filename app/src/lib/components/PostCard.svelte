<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import type { PostMeta } from '$lib/content';
	import { slugify } from '$lib/content';

	let { post }: { post: PostMeta } = $props();

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(dateStr));
	}

	function getStatus(
		stepsStatus: string[]
	): { label: string; variant: 'default' | 'destructive' | 'secondary' } {
		const lastNonEmpty = [...stepsStatus].reverse().find((s) => s.trim() !== '');
		if (!lastNonEmpty) return { label: 'En cours', variant: 'secondary' };
		if (lastNonEmpty.includes('adopté')) return { label: 'Adopté ✅', variant: 'default' };
		if (lastNonEmpty.includes('rejeté')) return { label: 'Rejeté ❌', variant: 'destructive' };
		return { label: lastNonEmpty.replace(/[✅❌]/g, '').trim(), variant: 'secondary' };
	}

	const status = $derived(getStatus(post.stepsStatus));
	const displayDate = $derived(formatDate(post.date));

	const accentColor = $derived(
		status.variant === 'default'
			? '#16a34a'
			: status.variant === 'destructive'
				? '#dc2626'
				: null
	);
</script>

<article
	class="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
>
	<!-- Status accent bar for definitive outcomes -->
	{#if accentColor}
		<div
			class="absolute inset-y-0 left-0 w-[3px] rounded-l-xl"
			style="background-color: {accentColor}"
		></div>
	{/if}

	<!-- Proposal number -->
	{#if post.proposalNum}
		<div
			class="absolute right-3 top-3 z-10 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-primary-foreground"
		>
			N°&nbsp;{post.proposalNum}
		</div>
	{/if}

	<div class="p-5">
		<div class="pr-16">
			<h2 class="mb-2 text-[0.9375rem] font-semibold leading-snug tracking-tight text-foreground">
				{post.proposalTitle}
			</h2>

			{#if post.auteurs.length > 0}
				<p class="mb-3 flex items-center gap-1.5">
					<svg
						class="h-3 w-3 shrink-0 text-muted-foreground/50"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
							d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
						/>
					</svg>
					<span class="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground/60">
						{post.auteurs[0]}
					</span>
					{#if post.auteurs.length > 1}
						<span
							class="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground"
						>
							+{post.auteurs.length - 1}
						</span>
					{/if}
				</p>
			{/if}

			{#if post.excerpt}
				<p
					class="mb-1 border-l-2 border-muted-foreground/20 pl-3 text-[12.5px] leading-relaxed text-muted-foreground line-clamp-2"
				>
					{post.excerpt}
				</p>
			{/if}
		</div>

		<div class="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
			<div class="flex flex-1 min-w-0 flex-wrap items-center gap-1.5">
				{#if displayDate}
					{#if post.link}
						<a
							href={post.link}
							target="_blank"
							rel="noopener noreferrer"
							onclick={(e) => e.stopPropagation()}
							class="relative z-10 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
							title="Voir sur assemblee-nationale.fr"
						>
							{displayDate} ↗
						</a>
					{:else}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
						>
							{displayDate}
						</span>
					{/if}
				{/if}

				{#each post.tags.slice(0, 3) as tag}
					<Badge
						variant="secondary"
						class="relative z-10 cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium"
						href="/tags/{slugify(tag)}"
						onclick={(e: MouseEvent) => e.stopPropagation()}
					>
						{tag}
					</Badge>
				{/each}
			</div>

			<div class="flex-shrink-0">
				<Badge
					variant={status.variant}
					class="rounded-full text-xs whitespace-nowrap {status.variant === 'default' ? '!bg-green-600 !text-white' : ''}"
				>
					{status.label}
				</Badge>
			</div>
		</div>
	</div>

	<a
		href="/posts/{post.slug}"
		class="absolute inset-0 z-0 rounded-xl"
		aria-label="Lire : {post.proposalTitle}"
	></a>
</article>
