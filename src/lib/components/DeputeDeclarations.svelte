<script lang="ts">
  import type { DeclarationSnapshot } from '$lib/server/declarations';
  import { formatAmount, formatPeriod, isPrivate, isZeroRemuneration } from '$lib/utils/declarations';

  interface Props {
    snapshots: DeclarationSnapshot[];
    groupeColour: string;
  }

  let { snapshots, groupeColour }: Props = $props();

  let selectedIndex = $state(0);
  $effect.pre(() => {
    selectedIndex = snapshots.length - 1;
  });

  const current = $derived(snapshots[selectedIndex]);
  const versionNumber = $derived(selectedIndex + 1);
  const totalVersions = $derived(snapshots.length);

  function formatDepotDate(raw: string): string {
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return raw;
    return `${match[1]}/${match[2]}/${match[3]}`;
  }

  function prev() {
    if (selectedIndex > 0) selectedIndex--;
  }
  function next() {
    if (selectedIndex < snapshots.length - 1) selectedIndex++;
  }

  const hasProActivities = $derived(
    !current?.sections.activProfCinqDerniere.neant || !current?.sections.activConsultant.neant,
  );
</script>

{#if snapshots.length === 0}
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
    <p class="text-sm font-medium text-muted-foreground">Aucune déclaration d'intérêts disponible</p>
    <p class="mt-1 text-xs text-muted-foreground/70">
      Les données HATVP ne sont pas encore disponibles pour ce député.
    </p>
  </div>
{:else}
  <div class="space-y-5">
    <!-- Version navigation -->
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
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span class="text-xs font-medium text-muted-foreground">
          Déposée le <span class="font-semibold text-foreground">{formatDepotDate(current.dateDepotRaw)}</span>
        </span>
        {#if current.isModificative}
          <span
            class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style="background-color: {groupeColour};"
          >
            Modificative
          </span>
        {/if}
      </div>

      {#if totalVersions > 1}
        <div class="flex items-center gap-1">
          <button
            onclick={prev}
            disabled={selectedIndex === 0}
            aria-label="Version précédente"
            class="inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span class="min-w-[4rem] text-center text-[11px] font-bold tabular-nums text-foreground">
            {versionNumber} / {totalVersions}
          </span>
          <button
            onclick={next}
            disabled={selectedIndex === snapshots.length - 1}
            aria-label="Version suivante"
            class="inline-flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      {/if}
    </div>

    <!-- Context info -->
    {#if current.context.organeLabel || current.context.dateDebutMandat}
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {#if current.context.organeLabel}
          <span
            >Circonscription : <strong class="font-semibold text-foreground">{current.context.organeLabel}</strong
            ></span
          >
        {/if}
        {#if current.context.dateDebutMandat}
          <span
            >Mandat depuis : <strong class="font-semibold text-foreground">{current.context.dateDebutMandat}</strong
            ></span
          >
        {/if}
      </div>
    {/if}

    <!-- ═══ Professional Activities ═══ -->
    {#if hasProActivities}
      <section>
        <h4
          class="mb-3 border-b pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          style="border-color: {groupeColour}50;"
        >
          Expérience professionnelle
        </h4>
        <div class="space-y-1.5">
          {#each [...current.sections.activProfCinqDerniere.items, ...current.sections.activConsultant.items] as item}
            <div class="rounded-r-md border-l-2 bg-muted/25 px-3 py-2.5" style="border-left-color: {groupeColour};">
              <div class="flex items-start justify-between gap-3">
                <span class="text-sm font-semibold leading-snug text-foreground">{item.description || '—'}</span>
                {#if item.period.debut || item.period.fin}
                  <span class="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
                    >{formatPeriod(item.period.debut, item.period.fin)}</span
                  >
                {/if}
              </div>
              {#if item.employeur && !isPrivate(item.employeur)}
                <p class="mt-0.5 text-xs text-muted-foreground">{item.employeur}</p>
              {/if}
              {#if item.remuneration && !isZeroRemuneration(item.remuneration.montants)}
                <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {#each item.remuneration.montants as { annee, montant }}
                    <span class="text-[11px] tabular-nums">
                      <span class="text-muted-foreground/70">{annee}</span>
                      {' '}
                      <span class="font-semibold text-foreground">{formatAmount(montant)}&nbsp;€</span>
                    </span>
                  {/each}
                  <span
                    class="rounded bg-muted px-1 py-px text-[9px] font-bold uppercase tracking-wide text-muted-foreground"
                    >{item.remuneration.brutNet}</span
                  >
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- ═══ Elected Mandates ═══ -->
    {#if !current.sections.mandatElectif.neant}
      <section>
        <h4
          class="mb-3 border-b pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          style="border-color: {groupeColour}50;"
        >
          Mandats électifs
        </h4>
        <div class="space-y-1.5">
          {#each current.sections.mandatElectif.items as item}
            {@const isDepute = item.descriptionMandat.toLowerCase().includes('député')}
            <div
              class="rounded-r-md border-l-2 px-3 py-2.5 {isDepute ? 'bg-muted/40' : 'bg-muted/20'}"
              style="border-left-color: {groupeColour};"
            >
              <div class="flex items-start justify-between gap-3">
                <span class="text-sm leading-snug text-foreground {isDepute ? 'font-bold' : 'font-semibold'}">
                  {item.descriptionMandat}
                </span>
                {#if item.period.debut || item.period.fin}
                  <span class="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
                    >{formatPeriod(item.period.debut, item.period.fin)}</span
                  >
                {/if}
              </div>
              {#if item.remuneration && !isZeroRemuneration(item.remuneration.montants)}
                <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {#each item.remuneration.montants as { annee, montant }}
                    <span class="text-[11px] tabular-nums">
                      <span class="text-muted-foreground/70">{annee}</span>
                      {' '}
                      <span class="font-semibold text-foreground">{formatAmount(montant)}&nbsp;€</span>
                    </span>
                  {/each}
                  <span
                    class="rounded bg-muted px-1 py-px text-[9px] font-bold uppercase tracking-wide text-muted-foreground"
                    >{item.remuneration.brutNet}</span
                  >
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- ═══ Dirigeant Participations ═══ -->
    {#if !current.sections.participationDirigeant.neant}
      <section>
        <h4
          class="mb-3 border-b pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          style="border-color: {groupeColour}50;"
        >
          Fonctions dirigeantes
        </h4>
        <div class="space-y-1.5">
          {#each current.sections.participationDirigeant.items as item}
            {@const zeroRem = !item.remuneration || isZeroRemuneration(item.remuneration.montants)}
            <div
              class="rounded-r-md border-l-2 bg-muted/25 px-3 py-2.5"
              style="border-left-color: {groupeColour};"
              class:opacity-50={zeroRem}
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <span class="text-sm font-medium text-foreground">
                    {isPrivate(item.nomSociete) ? '—' : item.nomSociete}
                  </span>
                  {#if item.activite}
                    <span class="text-xs text-muted-foreground"> — {item.activite}</span>
                  {/if}
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  {#if !zeroRem}
                    <span
                      class="rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
                      style="background-color: {groupeColour};">Rémunéré</span
                    >
                  {:else}
                    <span
                      class="rounded bg-muted px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60"
                      >Bénévole</span
                    >
                  {/if}
                  {#if item.period.debut || item.period.fin}
                    <span class="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
                      >{formatPeriod(item.period.debut, item.period.fin)}</span
                    >
                  {/if}
                </div>
              </div>
              {#if item.remuneration && !zeroRem}
                <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {#each item.remuneration.montants as { annee, montant }}
                    <span class="text-[11px] tabular-nums">
                      <span class="text-muted-foreground/70">{annee}</span>
                      {' '}
                      <span class="font-semibold text-foreground">{formatAmount(montant)}&nbsp;€</span>
                    </span>
                  {/each}
                  <span
                    class="rounded bg-muted px-1 py-px text-[9px] font-bold uppercase tracking-wide text-muted-foreground"
                    >{item.remuneration.brutNet}</span
                  >
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- ═══ Financial Participations ═══ -->
    {#if !current.sections.participationFinanciere.neant}
      <section>
        <h4
          class="mb-3 border-b pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          style="border-color: {groupeColour}50;"
        >
          Participations financières
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr
                class="border-b border-border/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                <th class="pb-1.5 pr-3 font-semibold">Société</th>
                <th class="pb-1.5 pr-3 text-right font-semibold">Capital</th>
                <th class="pb-1.5 pr-3 text-right font-semibold">Évaluation</th>
                <th class="pb-1.5 text-right font-semibold">Conseil</th>
              </tr>
            </thead>
            <tbody>
              {#each current.sections.participationFinanciere.items as item}
                <tr class="border-b border-border/30 last:border-0">
                  <td class="py-2 pr-3 font-medium text-foreground">
                    {isPrivate(item.nomSociete) ? '—' : item.nomSociete}
                  </td>
                  <td class="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                    {item.capitalDetenu ? `${item.capitalDetenu}\u00a0%` : '—'}
                  </td>
                  <td class="py-2 pr-3 text-right tabular-nums text-foreground">
                    {item.evaluation ? `${formatAmount(item.evaluation)}\u00a0€` : '—'}
                  </td>
                  <td class="py-2 text-right">
                    {#if item.actiConseil === 'Oui'}
                      <span
                        class="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        >Oui</span
                      >
                    {:else}
                      <span class="text-muted-foreground/40">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    <!-- ═══ Voluntary Functions ═══ -->
    {#if !current.sections.fonctionBenevole.neant}
      <section>
        <h4
          class="mb-3 border-b pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          style="border-color: {groupeColour}50;"
        >
          Fonctions bénévoles
        </h4>
        <div class="flex flex-wrap gap-1.5">
          {#each current.sections.fonctionBenevole.items as item}
            <span class="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs">
              <span class="font-medium text-foreground">{item.nomStructure}</span>
              {#if item.descriptionActivite}
                <span class="ml-1.5 text-muted-foreground">— {item.descriptionActivite}</span>
              {/if}
            </span>
          {/each}
        </div>
      </section>
    {/if}

    <!-- ═══ Spouse Activity ═══ -->
    {#if !current.sections.activProfConjoint.neant}
      {@const visibleItems = current.sections.activProfConjoint.items.filter(
        (i) => !isPrivate(i.activiteProf) || !isPrivate(i.employeurConjoint),
      )}
      {#if visibleItems.length > 0}
        <section>
          <h4
            class="mb-3 border-b pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            style="border-color: {groupeColour}50;"
          >
            Activité du conjoint
          </h4>
          {#each visibleItems as item}
            <p class="text-xs text-muted-foreground">
              {isPrivate(item.activiteProf) ? '—' : item.activiteProf}
              {#if !isPrivate(item.employeurConjoint)}
                <span class="italic"> chez {item.employeurConjoint}</span>
              {/if}
            </p>
          {/each}
        </section>
      {/if}
    {/if}

    <!-- ═══ Parliamentary Collaborators ═══ -->
    {#if !current.sections.activCollaborateurs.neant}
      <section>
        <h4
          class="mb-3 border-b pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          style="border-color: {groupeColour}50;"
        >
          Collaborateurs parlementaires
        </h4>
        <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {#each current.sections.activCollaborateurs.items as item}
            <div class="flex items-baseline gap-1.5 text-xs">
              <span class="font-medium text-foreground">{item.nom}</span>
              {#if item.descriptionActivite}
                <span class="text-muted-foreground/70">{item.descriptionActivite}</span>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- ═══ Observations ═══ -->
    {#if !current.sections.observationInteret.neant}
      {@const visibleObs = current.sections.observationInteret.items.filter((i) => !isPrivate(i.contenu))}
      {#if visibleObs.length > 0}
        <section>
          <h4
            class="mb-3 border-b pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            style="border-color: {groupeColour}50;"
          >
            Observations
          </h4>
          {#each visibleObs as item}
            <p class="rounded-md bg-muted/30 px-3 py-2 text-xs italic leading-relaxed text-muted-foreground">
              {item.contenu}
            </p>
          {/each}
        </section>
      {/if}
    {/if}
    <!-- Disclaimer -->
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
      Ces informations sont déclarées sur l'honneur par le député lui-même auprès de la
      <abbr title="Haute Autorité pour la transparence de la vie publique" class="no-underline">HATVP</abbr>. Elles
      n'ont pas fait l'objet d'une vérification indépendante.
    </p>
  </div>
{/if}
