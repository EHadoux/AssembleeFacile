<script lang="ts">
	import type { PageData } from './$types';
	import { Badge } from '$lib/components/ui/badge';
	import { slugify } from '$lib/content';

	let { data }: { data: PageData } = $props();

	const { meta, component: Content } = $derived(data);

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(dateStr));
	}

	function getStatus(stepsStatus: string[]): { label: string; color: string } {
		const last = [...stepsStatus].reverse().find((s) => s.trim() !== '');
		if (!last) return { label: 'En cours', color: 'text-muted-foreground' };
		if (last.includes('adopté')) return { label: 'Adopté ✅', color: 'text-green-700' };
		if (last.includes('rejeté')) return { label: 'Rejeté ❌', color: 'text-red-700' };
		return { label: last.replace(/[✅❌]/g, '').trim(), color: 'text-muted-foreground' };
	}

	const status = $derived(getStatus(meta.stepsStatus));
</script>

<svelte:head>
	<title>{meta.proposalTitle} | Assemblée Facile</title>
	<meta name="description" content="Proposition de loi N°{meta.proposalNum} : {meta.proposalTitle}" />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">

		<!-- Main content -->
		<article>
			<!-- Breadcrumb -->
			<nav class="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
				<a href="/" class="hover:text-primary">Accueil</a>
				<span>/</span>
				<span class="text-foreground">N°&nbsp;{meta.proposalNum}</span>
			</nav>

			<!-- Title -->
			<header class="mb-6">
				<div class="mb-3 flex flex-wrap items-center gap-2">
					<span class="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
						N°&nbsp;{meta.proposalNum}
					</span>
					<span class="text-sm font-medium {status.color}">{status.label}</span>
				</div>
				<h1 class="text-2xl font-extrabold leading-snug tracking-tight text-foreground sm:text-3xl">
					{meta.proposalTitle}
				</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					Déposé le {formatDate(meta.date)}
					{#if meta.link}
						·
						<a
							href={meta.link}
							target="_blank"
							rel="noopener noreferrer"
							class="font-medium text-primary hover:underline"
						>
							Voir sur assemblee-nationale.fr ↗
						</a>
					{/if}
				</p>
				{#if meta.tags.length}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each meta.tags as tag}
							<Badge variant="secondary" class="rounded-full text-xs" href="/tags/{slugify(tag)}">
								{tag}
							</Badge>
						{/each}
					</div>
				{/if}
			</header>

			<!-- Legislative steps -->
			{#if meta.stepsName.length}
				<div class="mb-8 rounded-xl border border-border bg-white p-5 shadow-sm">
					<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
						Parcours législatif
					</h2>
					<ol class="relative flex flex-col gap-4 pl-5">
						{#each meta.stepsName as stepName, i}
							{@const isDone = meta.stepsStatus[i]?.trim() !== ''}
							{@const isAdopted = meta.stepsStatus[i]?.includes('adopté')}
							{@const isRejected = meta.stepsStatus[i]?.includes('rejeté')}
							<li class="relative">
								<!-- Timeline dot -->
								<span
									class="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full border-2 border-background
										{isDone
											? isAdopted
												? 'bg-green-500'
												: isRejected
												? 'bg-red-500'
												: 'bg-primary'
											: 'bg-border'}"
								></span>
								<p class="text-sm font-semibold text-foreground leading-tight">{stepName}</p>
								{#if meta.stepsDate[i]}
									<p class="mt-0.5 text-xs text-muted-foreground">{meta.stepsDate[i]}</p>
								{/if}
								{#if meta.stepsStatus[i]?.trim()}
									<p class="mt-0.5 text-xs font-medium
										{isAdopted ? 'text-green-700' : isRejected ? 'text-red-700' : 'text-muted-foreground'}">
										{meta.stepsStatus[i]}
									</p>
								{/if}
							</li>
						{/each}
					</ol>
				</div>
			{/if}

			<!-- Markdown content -->
			<div class="prose">
				<Content />
			</div>
		</article>

		<!-- Sidebar -->
		<aside class="flex flex-col gap-5">
			<!-- Authors -->
			<div class="rounded-xl border border-border bg-white p-5 shadow-sm">
				<h3 class="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					{meta.auteurs.length > 1 ? 'Signataires' : 'Auteur'}
				</h3>
				<ul class="flex flex-col gap-1.5">
					{#each meta.auteurs as auteur}
						<li>
							<a
								href="/auteurs/{slugify(auteur)}"
								class="text-sm font-medium text-foreground hover:text-primary transition-colors"
							>
								{auteur}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</aside>
	</div>
</div>
