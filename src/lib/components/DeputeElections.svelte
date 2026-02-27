<script lang="ts">
  import type { ElectionCandidate, ElectionResult, ElectionRound } from '$lib/server/elections';
  import { formatPct, formatVoix, getNuanceColour, getNuanceLabel } from '$lib/utils/elections';

  let { election, groupeColour }: { election: ElectionResult | null; groupeColour: string } = $props();

  let tooltip = $state<{ candidate: ElectionCandidate; x: number; y: number } | null>(null);

  function showTooltip(e: MouseEvent, candidate: ElectionCandidate) {
    tooltip = { candidate, x: e.clientX, y: e.clientY };
  }

  function hideTooltip() {
    tooltip = null;
  }

  function moveTooltip(e: MouseEvent) {
    if (tooltip) tooltip = { ...tooltip, x: e.clientX, y: e.clientY };
  }

  function roundLabel(round: ElectionRound): string {
    return round.round === 1 ? '1er tour' : '2e tour';
  }

  function roundDate(round: ElectionRound): string {
    return round.round === 1 ? '30 juin 2024' : '7 juillet 2024';
  }

  function sortedCandidates(round: ElectionRound): ElectionCandidate[] {
    return [...round.candidates].sort((a, b) => b.pctExprimes - a.pctExprimes);
  }
</script>

{#if !election}
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="mb-3 h-10 w-10 text-muted-foreground/40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
    <p class="text-sm font-medium text-muted-foreground">Données électorales non disponibles</p>
    <p class="mt-1 text-xs text-muted-foreground/70">Aucun résultat trouvé pour cette circonscription.</p>
  </div>
{:else}
  <div class="mt-6 space-y-5">
    <!-- Constituency header — mirrors the version navigation bar in declarations -->
    <div class="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <div class="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
        <span class="text-xs font-medium text-muted-foreground">
          {election.circoLabel}
          <span class="font-semibold text-foreground">&mdash; {election.departementNom}</span>
        </span>
      </div>
      <span
        class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
        style="background-color: {groupeColour};"
      >
        Législatives 2024
      </span>
    </div>

    <!-- One card per round -->
    {#each [election.round1, election.round2].filter((r): r is ElectionRound => r !== null) as round}
      {@const usedPct = round.candidates.reduce((s, c) => s + c.pctExprimes, 0)}
      {@const candidates = sortedCandidates(round)}

      <section>
        <!-- Section header — exact same style as declarations sections -->
        <h4
          class="mb-3 border-b pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          style="border-color: {groupeColour}50;"
        >
          {roundLabel(round)}
          <span class="ml-1.5 font-medium normal-case tracking-normal">— {roundDate(round)}</span>
        </h4>

        <!-- Proportional bar -->
        <div
          class="relative mb-3 flex h-7 w-full overflow-hidden rounded-md shadow-sm"
          role="img"
          aria-label="Résultats du {roundLabel(round)}"
        >
          {#each round.candidates as candidate}
            {@const colour = getNuanceColour(candidate.nuance)}
            {@const isHighlighted = candidate.elu || (round.round === 1 && candidate.qualifie)}
            <button
              class="group relative h-full cursor-default transition-all duration-150 hover:brightness-110"
              style="width: {candidate.pctExprimes}%; background-color: {colour}; opacity: {isHighlighted ? 1 : 0.2};"
              onmouseenter={(e) => showTooltip(e, candidate)}
              onmouseleave={hideTooltip}
              onmousemove={moveTooltip}
              aria-label="{candidate.prenom} {candidate.nom} — {formatPct(candidate.pctExprimes)}"
            >
              <!-- Percentage label on wide enough segments -->
              {#if candidate.pctExprimes >= 12}
                <span
                  class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 tabular-nums drop-shadow-sm"
                >
                  {Math.round(candidate.pctExprimes)}&thinsp;%
                </span>
              {/if}
            </button>
          {/each}
          <!-- Remaining votes (blancs/nuls not in exprimés — very subtle) -->
          {#if usedPct < 99}
            <div class="h-full bg-border/30" style="width: {100 - usedPct}%;"></div>
          {/if}
        </div>

        <!-- Candidate rows — left-border card style matching declarations -->
        <div class="space-y-1.5">
          {#each candidates as candidate}
            {@const colour = getNuanceColour(candidate.nuance)}
            {@const isHighlighted = candidate.elu || (round.round === 1 && candidate.qualifie)}
            <div
              class="rounded-r-md border-l-2 px-3 py-2 transition-opacity {isHighlighted
                ? 'bg-muted/40'
                : 'bg-muted/20 opacity-30'}"
              style="border-left-color: {colour};"
            >
              <div class="flex items-center gap-3">
                <!-- Name + nuance -->
                <div class="min-w-0 flex-1">
                  <span class="text-sm leading-none text-foreground {isHighlighted ? 'font-bold' : 'font-medium'}">
                    {candidate.prenom}
                    {candidate.nom}
                  </span>
                  <span class="ml-1.5 text-[11px] text-muted-foreground/80">{getNuanceLabel(candidate.nuance)}</span>
                </div>

                <!-- Badges -->
                <div class="flex shrink-0 items-center gap-1.5">
                  {#if candidate.elu}
                    <span
                      class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style="background-color: {colour};"
                    >
                      {candidate.sexe === 'FEMININ' ? 'Élue' : 'Élu'}
                    </span>
                  {:else if round.round === 1 && candidate.qualifie}
                    <span
                      class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                    >
                      → 2e tour
                    </span>
                  {/if}

                  <!-- Percentage -->
                  <span class="w-12 text-right text-xs font-bold tabular-nums text-foreground">
                    {formatPct(candidate.pctExprimes)}
                  </span>
                </div>
              </div>

              <!-- Mini proportional bar -->
              <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-background/60">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  style="width: {candidate.pctExprimes}%; background-color: {colour};"
                ></div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Participation stats — matches declarations footer style -->
        <div
          class="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs text-muted-foreground"
          style="border-color: {groupeColour}20;"
        >
          <span>
            Participation&nbsp;:
            <strong class="font-semibold text-foreground">{formatPct(round.pctVotants)}</strong>
          </span>
          <span>
            Inscrits&nbsp;:
            <strong class="font-semibold text-foreground">{formatVoix(round.inscrits)}</strong>
          </span>
          <span>
            Exprimés&nbsp;:
            <strong class="font-semibold text-foreground">{formatVoix(round.exprimes)}</strong>
          </span>
          {#if round.blancs > 0}
            <span>Blancs&nbsp;: {formatVoix(round.blancs)}</span>
          {/if}
          {#if round.nuls > 0}
            <span>Nuls&nbsp;: {formatVoix(round.nuls)}</span>
          {/if}
        </div>
      </section>
    {/each}

    <!-- Source note — mirrors declarations disclaimer -->
    <p
      class="flex items-start gap-1.5 border-t border-border/40 pt-4 text-[11px] leading-relaxed text-muted-foreground/60"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="mt-px h-3 w-3 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      Source&nbsp;: Ministère de l'Intérieur — Résultats officiels des élections législatives des 30&nbsp;juin et 7&nbsp;juillet&nbsp;2024.
    </p>
  </div>
{/if}

<!-- Tooltip -->
{#if tooltip}
  <div
    class="pointer-events-none fixed z-50 max-w-50 rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-xl"
    style="left: {tooltip.x + 14}px; top: {tooltip.y - 64}px;"
  >
    <p class="font-bold">{tooltip.candidate.prenom} {tooltip.candidate.nom}</p>
    <p class="mt-0.5 text-background/70">{getNuanceLabel(tooltip.candidate.nuance)}</p>
    <p class="mt-1 font-bold tabular-nums">{formatPct(tooltip.candidate.pctExprimes)}</p>
    <p class="tabular-nums text-background/60">{formatVoix(tooltip.candidate.voix)} voix</p>
  </div>
{/if}
