<script lang="ts">
	import { page } from '$app/stores';

	const nav = [
		{ href: '/search', label: 'Rechercher' },
		{ href: '/auteurs', label: 'Auteurs' },
		{ href: '/tags', label: 'Thématiques' }
	];
</script>

<header class="sticky top-0 z-50 border-b border-border/60 bg-white/90 backdrop-blur-md">
	<div class="mx-auto flex max-w-6xl items-center gap-2 sm:gap-6 px-4 py-3">
		<!-- Logo -->
		<a href="/" class="flex items-center gap-2.5 shrink-0">
			<img src="/logo.svg" alt="Assemblée Facile" class="h-8 w-8" />
			<span class="hidden sm:block text-base font-bold tracking-tight text-foreground">
				Assemblée<span class="text-primary">Facile</span>
			</span>
		</a>

		<div class="flex-1"></div>

		<!-- Nav -->
		<nav class="flex items-center gap-0.5 sm:gap-1">
			{#each nav as { href, label }}
				<a
					{href}
					data-sveltekit-preload-data="hover"
					class="rounded-md px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm font-medium transition-colors
						{$page.url.pathname.startsWith(href)
						? 'bg-primary/10 text-primary'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
				>
					{label}
				</a>
			{/each}
		</nav>
	</div>
</header>
