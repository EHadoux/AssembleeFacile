import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Types ──────────────────────────────────────────────────────────────

export interface AmountByYear {
  annee: number;
  montant: string;
}

export interface Remuneration {
  brutNet: string;
  montants: AmountByYear[];
}

export interface DatePeriod {
  debut: string;
  fin: string;
}

export interface ConsultantActivityItem {
  description: string;
  employeur: string;
  remuneration: Remuneration | null;
  period: DatePeriod;
}

export interface ProfessionalActivityItem {
  description: string;
  employeur: string;
  remuneration: Remuneration | null;
  period: DatePeriod;
}

export interface ConjointActivityItem {
  employeurConjoint: string;
  activiteProf: string;
}

export interface MandatItem {
  descriptionMandat: string;
  remuneration: Remuneration | null;
  period: DatePeriod;
}

export interface ParticipationDirigeantItem {
  nomSociete: string;
  activite: string;
  remuneration: Remuneration | null;
  period: DatePeriod;
}

export interface ParticipationFinanciereItem {
  nomSociete: string;
  evaluation: string;
  capitalDetenu: string;
  nombreParts: string;
  remuneration: string;
  actiConseil: string;
}

export interface FonctionBenevoleItem {
  nomStructure: string;
  descriptionActivite: string;
}

export interface CollaborateurItem {
  nom: string;
  employeur: string;
  descriptionActivite: string;
}

export interface ObservationItem {
  contenu: string;
}

// Sections keyed by DTO name
export interface DeclarationSections {
  activConsultant: { neant: boolean; items: ConsultantActivityItem[] };
  activProfCinqDerniere: { neant: boolean; items: ProfessionalActivityItem[] };
  activProfConjoint: { neant: boolean; items: ConjointActivityItem[] };
  mandatElectif: { neant: boolean; items: MandatItem[] };
  participationDirigeant: { neant: boolean; items: ParticipationDirigeantItem[] };
  participationFinanciere: { neant: boolean; items: ParticipationFinanciereItem[] };
  fonctionBenevole: { neant: boolean; items: FonctionBenevoleItem[] };
  activCollaborateurs: { neant: boolean; items: CollaborateurItem[] };
  observationInteret: { neant: boolean; items: ObservationItem[] };
}

export interface DeclarationContext {
  typeLabel: string;
  isModificative: boolean;
  dateDepot: string;
  declarantCivilite: string;
  declarantNom: string;
  declarantPrenom: string;
  organeLabel: string;
  dateDebutMandat: string;
}

export interface DeclarationSnapshot {
  dateDepot: string;
  dateDepotRaw: string;
  isModificative: boolean;
  context: DeclarationContext;
  sections: DeclarationSections;
}

// ── Internal raw parsed declaration ────────────────────────────────────

interface RawDeclaration {
  dateDepotRaw: string;
  dateDepotSortable: string;
  isModificative: boolean;
  context: DeclarationContext;
  presentSections: Map<keyof DeclarationSections, DeclarationSections[keyof DeclarationSections]>;
}

// ── Section keys mapped to XML tag names ───────────────────────────────

const SECTION_DTO_MAP: Record<keyof DeclarationSections, string> = {
  activConsultant: 'activConsultantDto',
  activProfCinqDerniere: 'activProfCinqDerniereDto',
  activProfConjoint: 'activProfConjointDto',
  mandatElectif: 'mandatElectifDto',
  participationDirigeant: 'participationDirigeantDto',
  participationFinanciere: 'participationFinanciereDto',
  fonctionBenevole: 'fonctionBenevoleDto',
  activCollaborateurs: 'activCollaborateursDto',
  observationInteret: 'observationInteretDto',
};

// ── Helpers ────────────────────────────────────────────────────────────

function text($el: Cheerio<Element>, selector: string): string {
  return $el.find(selector).first().text().trim();
}

function parseDateDepot(raw: string): string {
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return '0000-00-00T00:00:00';
  const [, dd, mm, yyyy, hh, min, ss] = match;
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

function parseRemuneration($: CheerioAPI, $el: Cheerio<Element>): Remuneration | null {
  const $rem = $el.find('> remuneration');
  if ($rem.length === 0) return null;
  const brutNet = $rem.find('> brutNet').text().trim();
  const montants: AmountByYear[] = [];
  $rem.find('> montant > montant').each((_, m) => {
    const annee = parseInt($(m).find('> annee').text().trim(), 10);
    const montant = $(m).find('> montant').text().trim();
    if (!isNaN(annee)) montants.push({ annee, montant });
  });
  return { brutNet, montants };
}

function parsePeriod($el: Cheerio<Element>): DatePeriod {
  return {
    debut: $el.find('> dateDebut').text().trim(),
    fin: $el.find('> dateFin').text().trim(),
  };
}

// ── Section parsers ────────────────────────────────────────────────────

function parseConsultantItems($: CheerioAPI, $dto: Cheerio<Element>): ConsultantActivityItem[] {
  const items: ConsultantActivityItem[] = [];
  $dto.find('> items > items').each((_, el) => {
    const $it = $(el);
    items.push({
      description: $it.find('> description').text().trim(),
      employeur: $it.find('> nomEmployeur').text().trim(),
      remuneration: parseRemuneration($, $it),
      period: parsePeriod($it),
    });
  });
  return items;
}

function parseProfItems($: CheerioAPI, $dto: Cheerio<Element>): ProfessionalActivityItem[] {
  const items: ProfessionalActivityItem[] = [];
  $dto.find('> items > items').each((_, el) => {
    const $it = $(el);
    items.push({
      description: $it.find('> description').text().trim(),
      employeur: $it.find('> employeur').text().trim(),
      remuneration: parseRemuneration($, $it),
      period: parsePeriod($it),
    });
  });
  return items;
}

function parseConjointItems($: CheerioAPI, $dto: Cheerio<Element>): ConjointActivityItem[] {
  const items: ConjointActivityItem[] = [];
  $dto.find('> items > items').each((_, el) => {
    const $it = $(el);
    items.push({
      employeurConjoint: $it.find('> employeurConjoint').text().trim(),
      activiteProf: $it.find('> activiteProf').text().trim(),
    });
  });
  return items;
}

function parseMandatItems($: CheerioAPI, $dto: Cheerio<Element>): MandatItem[] {
  const items: MandatItem[] = [];
  $dto.find('> items > items').each((_, el) => {
    const $it = $(el);
    items.push({
      descriptionMandat: $it.find('> descriptionMandat').text().trim(),
      remuneration: parseRemuneration($, $it),
      period: parsePeriod($it),
    });
  });
  return items;
}

function parseParticipationDirigeantItems($: CheerioAPI, $dto: Cheerio<Element>): ParticipationDirigeantItem[] {
  const items: ParticipationDirigeantItem[] = [];
  $dto.find('> items > items').each((_, el) => {
    const $it = $(el);
    items.push({
      nomSociete: $it.find('> nomSociete').text().trim(),
      activite: $it.find('> activite').text().trim(),
      remuneration: parseRemuneration($, $it),
      period: parsePeriod($it),
    });
  });
  return items;
}

function parseParticipationFinanciereItems($: CheerioAPI, $dto: Cheerio<Element>): ParticipationFinanciereItem[] {
  const items: ParticipationFinanciereItem[] = [];
  $dto.find('> items > items').each((_, el) => {
    const $it = $(el);
    items.push({
      nomSociete: $it.find('> nomSociete').text().trim(),
      evaluation: $it.find('> evaluation').text().trim(),
      capitalDetenu: $it.find('> capitalDetenu').text().trim(),
      nombreParts: $it.find('> nombreParts').text().trim(),
      remuneration: $it.find('> remuneration').text().trim(),
      actiConseil: $it.find('> actiConseil').text().trim(),
    });
  });
  return items;
}

function parseFonctionBenevoleItems($: CheerioAPI, $dto: Cheerio<Element>): FonctionBenevoleItem[] {
  const items: FonctionBenevoleItem[] = [];
  $dto.find('> items > items').each((_, el) => {
    const $it = $(el);
    items.push({
      nomStructure: $it.find('> nomStructure').text().trim(),
      descriptionActivite: $it.find('> descriptionActivite').text().trim(),
    });
  });
  return items;
}

function parseCollaborateurItems($: CheerioAPI, $dto: Cheerio<Element>): CollaborateurItem[] {
  const items: CollaborateurItem[] = [];
  $dto.find('> items > items').each((_, el) => {
    const $it = $(el);
    items.push({
      nom: $it.find('> nom').text().trim(),
      employeur: $it.find('> employeur').text().trim(),
      descriptionActivite: $it.find('> descriptionActivite').text().trim(),
    });
  });
  return items;
}

function parseObservationItems($: CheerioAPI, $dto: Cheerio<Element>): ObservationItem[] {
  const items: ObservationItem[] = [];
  $dto.find('> items > items').each((_, el) => {
    const $it = $(el);
    items.push({
      contenu: $it.find('> contenu').text().trim(),
    });
  });
  return items;
}

type SectionParser = ($: CheerioAPI, $dto: Cheerio<Element>) => DeclarationSections[keyof DeclarationSections]['items'];

const SECTION_PARSERS: Record<keyof DeclarationSections, SectionParser> = {
  activConsultant: parseConsultantItems,
  activProfCinqDerniere: parseProfItems,
  activProfConjoint: parseConjointItems,
  mandatElectif: parseMandatItems,
  participationDirigeant: parseParticipationDirigeantItems,
  participationFinanciere: parseParticipationFinanciereItems,
  fonctionBenevole: parseFonctionBenevoleItems,
  activCollaborateurs: parseCollaborateurItems,
  observationInteret: parseObservationItems,
};

// ── Core parsing ───────────────────────────────────────────────────────

function parseContext($: CheerioAPI, $decl: Cheerio<Element>): DeclarationContext {
  const dateDepotRaw = text($decl, '> dateDepot');
  const $gen = $decl.find('> general');
  return {
    typeLabel: text($gen, '> typeDeclaration > label'),
    isModificative: text($decl, '> general > declarationModificative') === 'true',
    dateDepot: dateDepotRaw,
    declarantCivilite: text($gen, '> declarant > civilite'),
    declarantNom: text($gen, '> declarant > nom'),
    declarantPrenom: text($gen, '> declarant > prenom'),
    organeLabel: text($gen, '> organe > labelOrgane'),
    dateDebutMandat: text($gen, '> dateDebutMandat'),
  };
}

function parseRawDeclaration($: CheerioAPI, $decl: Cheerio<Element>): RawDeclaration {
  const dateDepotRaw = text($decl, '> dateDepot');
  const context = parseContext($, $decl);

  const presentSections = new Map<keyof DeclarationSections, DeclarationSections[keyof DeclarationSections]>();

  for (const [key, xmlTag] of Object.entries(SECTION_DTO_MAP)) {
    const sectionKey = key as keyof DeclarationSections;
    const $dto = $decl.find(`> ${xmlTag}`);
    if ($dto.length === 0) continue;

    const neant = $dto.find('> neant').text().trim() === 'true';
    const parser = SECTION_PARSERS[sectionKey];
    const items = neant ? [] : (parser($, $dto) as never[]);
    presentSections.set(sectionKey, { neant, items });
  }

  return {
    dateDepotRaw,
    dateDepotSortable: parseDateDepot(dateDepotRaw),
    isModificative: context.isModificative,
    context,
    presentSections,
  };
}

function makeEmptySections(): DeclarationSections {
  return {
    activConsultant: { neant: true, items: [] },
    activProfCinqDerniere: { neant: true, items: [] },
    activProfConjoint: { neant: true, items: [] },
    mandatElectif: { neant: true, items: [] },
    participationDirigeant: { neant: true, items: [] },
    participationFinanciere: { neant: true, items: [] },
    fonctionBenevole: { neant: true, items: [] },
    activCollaborateurs: { neant: true, items: [] },
    observationInteret: { neant: true, items: [] },
  };
}

function cloneSections(sections: DeclarationSections): DeclarationSections {
  return JSON.parse(JSON.stringify(sections));
}

function reconstructSnapshots(rawDeclarations: RawDeclaration[]): DeclarationSnapshot[] {
  const sorted = [...rawDeclarations].sort((a, b) => a.dateDepotSortable.localeCompare(b.dateDepotSortable));

  let currentState = makeEmptySections();
  const snapshots: DeclarationSnapshot[] = [];

  for (const raw of sorted) {
    if (!raw.isModificative) {
      currentState = makeEmptySections();
      for (const [key, value] of raw.presentSections) {
        currentState[key] = value as never;
      }
    } else {
      for (const [key, value] of raw.presentSections) {
        currentState[key] = value as never;
      }
    }

    snapshots.push({
      dateDepot: raw.dateDepotSortable,
      dateDepotRaw: raw.dateDepotRaw,
      isModificative: raw.isModificative,
      context: raw.context,
      sections: cloneSections(currentState),
    });
  }

  return snapshots;
}

// ── Public API ─────────────────────────────────────────────────────────

export function loadDeclarations(deputeId: string): DeclarationSnapshot[] {
  const filePath = join(process.cwd(), 'assets/declarations/deputes', `${deputeId}.xml`);
  if (!existsSync(filePath)) return [];

  try {
    const xmlContent = readFileSync(filePath, 'utf-8');
    const $ = load(`<root>${xmlContent}</root>`, { xmlMode: true });
    const declarations = $('root > declaration').toArray();
    if (declarations.length === 0) return [];

    const rawDeclarations = declarations.map((el) => parseRawDeclaration($, $(el)));
    return reconstructSnapshots(rawDeclarations);
  } catch {
    return [];
  }
}
