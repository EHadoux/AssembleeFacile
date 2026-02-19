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
</script>

<article
	class="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
>
	<!-- Proposal number -->
	{#if post.proposalNum}
		<div
			class="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground tabular-nums z-10"
		>
			N°&nbsp;{post.proposalNum}
		</div>
	{/if}

	<div class="p-5 pr-20">
		<h2 class="mb-2 text-[0.9375rem] font-semibold leading-snug tracking-tight text-foreground">
			{post.proposalTitle}
		</h2>

		{#if post.auteurs.length > 0}
			<p class="mb-3 text-xs text-muted-foreground">
				{post.auteurs[0]}
				{#if post.auteurs.length > 1}
					<span class="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
						+{post.auteurs.length - 1}
					</span>
				{/if}
			</p>
		{/if}

		<div class="flex flex-wrap items-center gap-1.5">
			{#if displayDate}
				<span class="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs text-muted-foreground font-medium">
					{displayDate}
					{#if post.link}
						<a
							href={post.link}
							target="_blank"
							rel="noopener noreferrer"
							onclick={(e) => e.stopPropagation()}
							class="relative z-10 text-primary opacity-60 hover:opacity-100"
							title="Voir sur assemblee-nationale.fr"
						>↗</a>
					{/if}
				</span>
			{/if}

			{#each post.tags.slice(0, 3) as tag}
				<Badge
					variant="secondary"
					class="relative z-10 rounded-full px-2.5 py-0.5 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
					href="/tags/{slugify(tag)}"
					onclick={(e: MouseEvent) => e.stopPropagation()}
				>
					{tag}
				</Badge>
			{/each}

			<Badge variant={status.variant} class="ml-auto rounded-full text-xs">
				{status.label}
			</Badge>
		</div>
	</div>

	<a
		href="/posts/{post.slug}"
		class="absolute inset-0 z-0 rounded-xl"
		aria-label="Lire : {post.proposalTitle}"
	></a>
</article>
