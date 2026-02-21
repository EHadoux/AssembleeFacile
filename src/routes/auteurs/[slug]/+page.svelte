<script lang="ts">
	import type { PageData } from './$types';
	import PostCard from '$lib/components/PostCard.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { slugify } from '$lib/content';

	let { data }: { data: PageData } = $props();

	let photoError = $state(false);
	let cosigPhotoErrors = $state<boolean[]>([]);
	$effect.pre(() => {
		cosigPhotoErrors = data.cosignataires.map(() => false);
	});

	const photoUrl = $derived(
		data.dep?.photo
			? `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${data.dep.photo}`
			: null
	);

	function scorePct(v: number | null | undefined): number | null {
		return v != null ? Math.round(v * 100) : null;
	}

	const scores = $derived(
		[
			{
				label: 'Participation',
				value: scorePct(data.dep?.score_participation),
				title: 'Taux de présence aux votes en séance plénière'
			},
			{
				label: 'Spécialité',
				value: scorePct(data.dep?.score_participation_specialite),
				title: 'Participation dans les votes de sa spécialité thématique'
			},
			{
				label: 'Loyauté',
				value: scorePct(data.dep?.score_loyaute),
				title: 'Taux de votes en accord avec la position de son groupe politique'
			}
		].filter((s) => s.value != null)
	);

	const initials = $derived(
		data.name
			.split(' ')
			.map((w: string) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);

	function formatDateShort(dateStr: string | null | undefined): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
	}

	const groupeColour = $derived(data.groupe?.couleur ?? '#6b7280');
</script>

<svelte:head>
	<title>{data.name} | Assemblée Facile</title>
	<meta
		name="description"
		content="Profil de {data.name}, député·e à l'Assemblée nationale. {data.totalPosts} propositions de loi."
	/>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8">
	<!-- Hero card -->
	<div class="mb-8 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
		<div class="h-1.5 w-full" style="background-color: {groupeColour};"></div>

		<div class="p-6 sm:p-8">
			<div class="flex flex-col gap-5 sm:flex-row sm:items-start">
				<!-- Photo -->
				<div class="shrink-0">
					{#if photoUrl && !photoError}
						<img
							src={photoUrl}
							alt={data.name}
							class="h-24 w-24 rounded-full bg-accent object-cover object-top ring-4 ring-border sm:h-28 sm:w-28"
							onerror={() => {
								photoError = true;
							}}
						/>
					{:else}
						<div
							class="flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold text-white ring-4 ring-white/30 sm:h-28 sm:w-28"
							style="background-color: {groupeColour};"
						>
							{initials}
						</div>
					{/if}
				</div>

				<!-- Identity -->
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
							{data.name}
						</h1>
						{#if data.groupe}
							<span
								class="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
								style="background-color: {data.groupe.couleur};"
							>
								{data.groupe.abrev}
							</span>
						{/if}
					</div>

					{#if data.groupe}
						<p class="mt-1 text-sm text-muted-foreground">{data.groupe.nom}</p>
					{/if}

					{#if data.dep?.profession}
						<p class="mt-1 text-sm italic text-muted-foreground">{data.dep.profession}</p>
					{/if}

					{#if data.dep?.departement_nom}
						<p class="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
							<span class="font-medium text-foreground">{data.dep.departement_nom}</span>
							{#if data.dep.circo}
								<span class="opacity-70">— {data.dep.circo}e circonscription</span>
							{/if}
							{#if data.dep.departement_code}
								<span
									class="inline-flex h-5 items-center rounded bg-accent px-1.5 text-[10px] font-bold text-muted-foreground"
								>
									{data.dep.departement_code}
								</span>
							{/if}
						</p>
					{/if}

					<!-- Contact & links row -->
					<div class="mt-4 flex flex-wrap items-center gap-2">
						{#if data.dep}
							<a
								href="https://www.assemblee-nationale.fr/dyn/deputes/{data.dep.id}"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-3.5 w-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline
										points="15 3 21 3 21 9"
									/><line x1="10" y1="14" x2="21" y2="3" />
								</svg>
								Profil officiel AN
							</a>
						{/if}

						{#if data.dep?.mail}
							<a
								href="mailto:{data.dep.mail}"
								class="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-3.5 w-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path
										d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
									/><polyline points="22,6 12,13 2,6" />
								</svg>
								E-mail
							</a>
						{/if}

						{#if data.dep?.twitter}
							<a
								href="https://twitter.com/{data.dep.twitter.replace('@', '')}"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-3.5 w-3.5"
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path
										d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"
									/>
								</svg>
								{data.dep.twitter}
							</a>
						{/if}

						{#if data.dep?.facebook}
							<a
								href={data.dep.facebook.startsWith('http') ? data.dep.facebook : `https://facebook.com/${data.dep.facebook}`}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
									<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
								</svg>
								Facebook
							</a>
						{/if}

						{#if data.dep?.website}
							<a
								href={data.dep.website.startsWith('http') ? data.dep.website : `https://${data.dep.website}`}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-3.5 w-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path
										d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
									/>
								</svg>
								Site web
							</a>
						{/if}
					</div>
				</div>
			</div>

			<!-- Stats panel -->
			<div class="mt-6 overflow-hidden rounded-xl border border-border/70 bg-accent/20">
				<!-- Counts row -->
				<div class="flex divide-x divide-border/70">
					<div class="flex-1 px-4 py-3 text-center">
						<p class="text-2xl font-extrabold tabular-nums text-foreground">{data.totalPosts}</p>
						<p class="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
							Proposition{data.totalPosts > 1 ? 's' : ''}
						</p>
					</div>

					{#if data.dep?.nombre_mandats != null}
						<div class="flex-1 px-4 py-3 text-center">
							<p class="text-2xl font-extrabold tabular-nums text-foreground">
								{data.dep.nombre_mandats}
							</p>
							<p class="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
								Mandat{data.dep.nombre_mandats > 1 ? 's' : ''}
							</p>
						</div>
					{/if}

					{#if data.dep?.date_prise_fonction}
						<div class="flex-1 px-4 py-3 text-center">
							<p class="text-[10px] uppercase tracking-wider text-muted-foreground">
								En fonction depuis
							</p>
							<p class="mt-1 text-sm font-bold text-foreground">
								{formatDateShort(data.dep.date_prise_fonction)}
							</p>
						</div>
					{/if}
				</div>

				<!-- Scores section -->
				{#if scores.length}
					<div class="border-t border-border/70 px-4 py-3.5">
						<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
							{#each scores as score}
								<div class="group relative flex items-center gap-3">
									<span
										class="w-28 shrink-0 cursor-help text-[11px] uppercase tracking-wide text-muted-foreground underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
										title={score.title}
									>
										{score.label}
									</span>
									<div class="flex-1 overflow-hidden rounded-full bg-background" style="height: 8px;">
										<div
											class="h-full rounded-full"
											style="width: {score.value}%; background-color: {groupeColour};"
										></div>
									</div>
									<span class="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-foreground">
										{score.value}%
									</span>
									<div
										class="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden w-56 rounded-md bg-foreground px-3 py-2 text-xs leading-snug text-background shadow-lg group-hover:block"
									>
										{score.title}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Two-column layout -->
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_240px]">
		<section>
			<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
				Propositions ({data.totalPosts})
			</h2>
			<div class="flex flex-col gap-3">
				{#each data.posts as post}
					<PostCard {post} />
				{/each}
			</div>

			{#if data.totalPages > 1}
				<Pagination
					pageNum={data.pageNum}
					totalPages={data.totalPages}
					pageUrl={(page) => `?page=${page}`}
				/>
			{/if}
		</section>

		<aside class="flex flex-col gap-5">
			<!-- Thématiques -->
			{#if data.topTags.length}
				<div class="rounded-xl border border-border bg-white p-5 shadow-sm">
					<h3 class="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
						Thématiques
					</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each data.topTags as { tag, count }}
							<Badge variant="secondary" class="rounded-full text-xs" href="/tags/{slugify(tag)}">
								{tag}
								<span class="ml-1 opacity-60">{count}</span>
							</Badge>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Co-signataires fréquents -->
			{#if data.cosignataires.length}
				<div class="rounded-xl border border-border bg-white p-5 shadow-sm">
					<h3 class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
						Co-signataires fréquents
					</h3>
					<ol class="flex flex-col gap-3">
						{#each data.cosignataires as { name, groupeAbrev, couleur, photo, count }, i}
							<li class="flex items-center gap-3">
								{#if photo && !cosigPhotoErrors[i]}
									<img
										src="https://www2.assemblee-nationale.fr/static/tribun/17/photos/{photo}"
										alt={name}
										class="h-8 w-8 shrink-0 rounded-full bg-accent object-cover object-top"
										onerror={() => {
											cosigPhotoErrors[i] = true;
										}}
									/>
								{:else}
									<div
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
										style="background-color: {couleur ?? '#9ca3af'};"
									>
										{name.split(' ').pop()?.[0] ?? '?'}
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<a
										href="/auteurs/{slugify(name)}"
										class="block truncate text-xs font-semibold text-foreground hover:text-primary hover:underline"
									>
										{name}
									</a>
									{#if groupeAbrev}
										<span
											class="mt-0.5 inline-block rounded-sm px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
											style="background-color: {couleur ?? '#9ca3af'};"
										>
											{groupeAbrev}
										</span>
									{/if}
								</div>
								<span class="shrink-0 text-xs font-bold tabular-nums text-primary">{count}</span>
							</li>
						{/each}
					</ol>
				</div>
			{/if}
		</aside>
	</div>
</div>
