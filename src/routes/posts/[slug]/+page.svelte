<script lang="ts">
	import type { PageData } from './$types';
	import { Badge } from '$lib/components/ui/badge';
	import { slugify } from '$lib/content';
	import PoliticalSpectrum from '$lib/components/PoliticalSpectrum.svelte';
	import { normalizeForLookup } from '$lib/utils/normalize';
	import { GROUPE_ORDER } from '$lib/utils/groupe-order';

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

	function findDepute(auteur: string) {
		const norm = normalizeForLookup(auteur);
		// Pass 1: exact full name match
		for (const d of data.deputes) {
			const fullA = normalizeForLookup(`${d.prenom} ${d.nom}`);
			const fullB = normalizeForLookup(`${d.nom} ${d.prenom}`);
			if (norm === fullA || norm === fullB) return d;
		}
		// Pass 2: both nom and prenom present
		for (const d of data.deputes) {
			const normNom = normalizeForLookup(d.nom);
			const normPrenom = normalizeForLookup(d.prenom);
			if (normNom && normPrenom && norm.includes(normNom) && norm.includes(normPrenom)) return d;
		}
		// Pass 3: nom only (last resort)
		for (const d of data.deputes) {
			const normNom = normalizeForLookup(d.nom);
			if (normNom && norm.includes(normNom)) return d;
		}
		return null;
	}

	const signatairesByGroupe = $derived.by(() => {
		const groupeMap = new Map(data.groupes.map((g) => [g.abrev, g]));
		const groups = new Map<string, Array<{ name: string; photo: string; slug: string; idx: number }>>();

		meta.auteurs.forEach((auteur, idx) => {
			const dep = findDepute(auteur);
			if (dep) {
				const arr = groups.get(dep.groupeAbrev) ?? [];
				arr.push({ name: auteur, photo: dep.photo, slug: slugify(auteur), idx });
				groups.set(dep.groupeAbrev, arr);
			}
		});

		return GROUPE_ORDER.flatMap((abrev) => {
			const groupe = groupeMap.get(abrev);
			const deputes = groups.get(abrev);
			if (!groupe || !deputes?.length) return [];
			return [{ groupeAbrev: abrev, couleur: groupe.couleur, nom: groupe.nom, deputes }];
		});
	});

	let photoErrors = $state<boolean[]>([]);
	$effect.pre(() => {
		photoErrors = meta.auteurs.map(() => false);
	});

	const SIGNATAIRES_LIMIT = 10;
	let expandedGroupes = $state(new Set<string>());
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

			<!-- Political distribution -->
			{#if meta.auteurs.length > 1}
				<div class="mb-8 rounded-xl border border-border bg-white p-5 shadow-sm">
					<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
						Répartition politique des signataires
					</h2>
					<PoliticalSpectrum
						auteurs={meta.auteurs}
						deputes={data.deputes}
						groupes={data.groupes}
					/>
				</div>
			{/if}

			<!-- Markdown content -->
			<div class="prose">
				<Content />
			</div>
		</article>

		<!-- Sidebar -->
		<aside class="flex flex-col gap-5">
			<div class="rounded-xl border border-border bg-white p-5 shadow-sm">
				<h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					{meta.auteurs.length > 1 ? 'Auteurs' : 'Auteur'}
				</h3>

				{#if signatairesByGroupe.length > 0}
					<div class="flex flex-col gap-4">
						{#each signatairesByGroupe as groupe}
							{@const isExpanded = expandedGroupes.has(groupe.groupeAbrev)}
							{@const visible = isExpanded ? groupe.deputes : groupe.deputes.slice(0, SIGNATAIRES_LIMIT)}
							{@const hiddenCount = groupe.deputes.length - SIGNATAIRES_LIMIT}
							<div>
								<!-- Party header -->
								<div class="mb-2 flex items-center gap-1.5">
									<span
										class="h-2 w-2 shrink-0 rounded-full"
										style="background-color: {groupe.couleur};"
									></span>
									<span
										class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white"
										style="background-color: {groupe.couleur};"
									>
										{groupe.groupeAbrev}
									</span>
									<span class="min-w-0 truncate text-[10px] text-muted-foreground">{groupe.nom}</span>
								</div>

								<!-- Deputies in this group -->
								<ul
									class="flex flex-col gap-1.5 border-l-2 pl-4"
									style="border-color: {groupe.couleur}33;"
								>
									{#each visible as dep}
										<li class="flex items-center gap-2">
											{#if dep.photo && !photoErrors[dep.idx]}
												<img
													src="https://www2.assemblee-nationale.fr/static/tribun/17/photos/{dep.photo}"
													alt={dep.name}
													class="h-7 w-7 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
													onerror={() => { photoErrors[dep.idx] = true; }}
												/>
											{:else}
												<div
													class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
													style="background-color: {groupe.couleur};"
												>
													{dep.name.split(' ').pop()?.[0] ?? '?'}
												</div>
											{/if}
											<a
												href="/auteurs/{dep.slug}"
												class="min-w-0 truncate text-xs font-medium text-foreground transition-colors hover:text-primary hover:underline"
											>
												{dep.name}
											</a>
										</li>
									{/each}
									{#if hiddenCount > 0}
										<li>
											<button
												class="cursor-pointer text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
												onclick={() => {
													const next = new Set(expandedGroupes);
													if (isExpanded) {
														next.delete(groupe.groupeAbrev);
													} else {
														next.add(groupe.groupeAbrev);
													}
													expandedGroupes = next;
												}}
											>
												{isExpanded ? 'Réduire' : `et ${hiddenCount} de plus`}
											</button>
										</li>
									{/if}
								</ul>
							</div>
						{/each}
					</div>

				{:else}
					<!-- Fallback when no depute matches found -->
					<ul class="flex flex-col gap-1.5">
						{#each meta.auteurs as auteur}
							<li>
								<a
									href="/auteurs/{slugify(auteur)}"
									class="text-sm font-medium text-foreground transition-colors hover:text-primary"
								>
									{auteur}
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</aside>
	</div>
</div>
