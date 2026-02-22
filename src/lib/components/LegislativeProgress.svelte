<script lang="ts">
	let {
		stepsName,
		stepsDate,
		stepsStatus
	}: {
		stepsName: string[];
		stepsDate: string[];
		stepsStatus: string[];
	} = $props();

	interface Step {
		name: string;
		date: string;
		status: string;
		dotClass: string;
	}

	function classifyStep(name: string, date: string, status: string): Step {
		const s = status ?? '';
		let dotClass: string;
		if (s.toLowerCase().includes('adopté')) {
			dotClass = 'bg-green-500';
		} else if (s.toLowerCase().includes('rejeté')) {
			dotClass = 'bg-red-500';
		} else if (s.trim() !== '') {
			dotClass = 'bg-amber-400';
		} else {
			dotClass = 'bg-gray-200 border border-dashed border-gray-300';
		}
		return { name, date, status: s, dotClass };
	}

	const anSteps = $derived(
		stepsName
			.map((name, i) => classifyStep(name, stepsDate[i] ?? '', stepsStatus[i] ?? ''))
			.filter((s) => {
				const n = s.name.toLowerCase();
				return n.includes('assemblée') && !n.includes('dépôt');
			})
	);

	const senatSteps = $derived(
		stepsName
			.map((name, i) => classifyStep(name, stepsDate[i] ?? '', stepsStatus[i] ?? ''))
			.filter((s) => {
				const n = s.name.toLowerCase();
				return n.includes('sénat') && !n.includes('dépôt');
			})
	);

	let tooltip = $state<{ x: number; y: number; lines: string[] } | null>(null);

	function showTooltip(e: MouseEvent, step: Step) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const lines: string[] = [step.name];
		if (step.date) lines.push(step.date);
		if (step.status) lines.push(step.status);
		tooltip = { x: rect.left + rect.width / 2, y: rect.top - 6, lines };
	}
</script>

{#if anSteps.length > 0 || senatSteps.length > 0}
	<div class="flex flex-col gap-0.5">
		{#if anSteps.length > 0}
			<div class="flex items-center gap-1">
				<img
					src="https://www.assemblee-nationale.fr/assets/images/logos/logo_an.webp"
					alt="AN"
					width="16"
					height="16"
					class="shrink-0"
					onerror={(e) => {
						const el = e.currentTarget as HTMLImageElement;
						el.replaceWith(Object.assign(document.createElement('span'), {
							className: 'text-[9px] font-bold text-muted-foreground w-4 text-center shrink-0',
							textContent: 'AN'
						}));
					}}
				/>
				<div class="flex items-center gap-1">
					{#each anSteps as step}
						<span
							role="img"
							aria-label={step.name}
							class="h-2 w-2 rounded-full cursor-default relative z-10 {step.dotClass}"
							onmousemove={(e) => showTooltip(e, step)}
							onmouseleave={() => (tooltip = null)}
						></span>
					{/each}
				</div>
			</div>
		{/if}

		{#if senatSteps.length > 0}
			<div class="flex items-center gap-1">
				<img
					src="https://www.assemblee-nationale.fr/assets/images/logos/logo_sn.webp"
					alt="SN"
					width="16"
					height="16"
					class="shrink-0"
					onerror={(e) => {
						const el = e.currentTarget as HTMLImageElement;
						el.replaceWith(Object.assign(document.createElement('span'), {
							className: 'text-[9px] font-bold text-muted-foreground w-4 text-center shrink-0',
							textContent: 'SN'
						}));
					}}
				/>
				<div class="flex items-center gap-1">
					{#each senatSteps as step}
						<span
							role="img"
							aria-label={step.name}
							class="h-2 w-2 rounded-full cursor-default relative z-10 {step.dotClass}"
							onmousemove={(e) => showTooltip(e, step)}
							onmouseleave={() => (tooltip = null)}
						></span>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

{#if tooltip}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background shadow-lg"
		style="left: {tooltip.x}px; top: {tooltip.y}px;"
	>
		{#each tooltip.lines as line, i}
			{#if i > 0}<br />{/if}{line}
		{/each}
	</div>
{/if}
