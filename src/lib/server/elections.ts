import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Types ──────────────────────────────────────────────────────────────

export interface ElectionCandidate {
  panneau: number;
  nuance: string;
  nom: string;
  prenom: string;
  sexe: string; // 'MASCULIN' | 'FEMININ'
  voix: number;
  pctExprimes: number;
  elu: boolean;
  qualifie: boolean; // passed to round 2 (for round 1 candidates)
}

export interface ElectionRound {
  round: 1 | 2;
  inscrits: number;
  votants: number;
  pctVotants: number;
  exprimes: number;
  blancs: number;
  nuls: number;
  candidates: ElectionCandidate[];
}

export interface ElectionResult {
  departementNom: string;
  circoLabel: string;
  round1: ElectionRound;
  round2: ElectionRound | null;
}

// ── CSV helpers ────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ';' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseFrPct(s: string): number {
  return parseFloat(s.replace('%', '').replace(',', '.').trim()) || 0;
}

function parseFrInt(s: string): number {
  return parseInt(s.replace(/\s+/g, '').trim(), 10) || 0;
}

/** Normalised constituency key from raw CSV dept code and circo code strings. */
function buildKeyFromCSV(deptCode: string, circoCode: string): string {
  const normDept = /^[0-9]+$/.test(deptCode) ? String(parseInt(deptCode, 10)) : deptCode.toUpperCase();
  const circoNum = parseInt(circoCode.slice(-2), 10);
  return `${normDept}_${circoNum}`;
}

// DB uses numeric codes where the CSV uses letter codes for some special constituencies.
const DB_TO_CSV_DEPT: Record<string, string> = {
  '099': 'ZZ', // Français établis hors de France
  '977': 'ZX', // Saint-Martin / Saint-Barthélemy
};

/** Normalised constituency key from DB deputes columns. */
function buildKeyFromDB(departementCode: string, circo: number): string {
  const remapped = DB_TO_CSV_DEPT[departementCode];
  if (remapped) return `${remapped}_${circo}`;
  const normDept = /^[0-9]+$/.test(departementCode)
    ? String(parseInt(departementCode, 10))
    : departementCode.toUpperCase();
  return `${normDept}_${circo}`;
}

// ── Row type ───────────────────────────────────────────────────────────

interface RawRow {
  departementNom: string;
  circoLabel: string;
  inscrits: number;
  votants: number;
  pctVotants: number;
  exprimes: number;
  blancs: number;
  nuls: number;
  candidates: Omit<ElectionCandidate, 'qualifie'>[];
}

// CSV column layout per candidate block (9 fields each, starting at column 18):
//   0: Numéro de panneau  1: Nuance  2: Nom  3: Prénom  4: Sexe
//   5: Voix  6: % Voix/inscrits  7: % Voix/exprimés  8: Elu
function parseRow(fields: string[]): RawRow {
  const departementNom = fields[1] ?? '';
  const circoLabel = fields[3] ?? '';
  const inscrits = parseFrInt(fields[4]);
  const votants = parseFrInt(fields[5]);
  const pctVotants = parseFrPct(fields[6]);
  const exprimes = parseFrInt(fields[9]);
  const blancs = parseFrInt(fields[12]);
  const nuls = parseFrInt(fields[15]);

  const CANDIDATE_START = 18;
  const FIELDS_PER_CANDIDATE = 9;

  const candidates: Omit<ElectionCandidate, 'qualifie'>[] = [];
  for (let i = CANDIDATE_START; i + FIELDS_PER_CANDIDATE - 1 < fields.length; i += FIELDS_PER_CANDIDATE) {
    const panneau = parseFrInt(fields[i]);
    if (!panneau) break;

    const nuance = fields[i + 1] ?? '';
    const nom = fields[i + 2] ?? '';
    const prenom = fields[i + 3] ?? '';
    const sexe = fields[i + 4] ?? '';
    const voix = parseFrInt(fields[i + 5]);
    const pctExprimes = parseFrPct(fields[i + 7]);
    const elu = (fields[i + 8] ?? '').toLowerCase() === 'élu';

    candidates.push({ panneau, nuance, nom, prenom, sexe, voix, pctExprimes, elu });
  }

  return { departementNom, circoLabel, inscrits, votants, pctVotants, exprimes, blancs, nuls, candidates };
}

// ── Cache ──────────────────────────────────────────────────────────────

type RoundRowMap = Map<string, RawRow>;

let _round1Map: RoundRowMap | null = null;
let _round2Map: RoundRowMap | null = null;

function loadCSV(filename: string): RoundRowMap {
  const filePath = join(process.cwd(), 'assets/elections/deputes/XVII', filename);
  if (!existsSync(filePath)) return new Map();

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const map: RoundRowMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 4) continue;

    const key = buildKeyFromCSV(fields[0], fields[2]);
    map.set(key, parseRow(fields));
  }

  return map;
}

function getRound1Map(): RoundRowMap {
  if (!_round1Map) _round1Map = loadCSV('1er-tour.csv');
  return _round1Map;
}

function getRound2Map(): RoundRowMap {
  if (!_round2Map) _round2Map = loadCSV('2eme-tour.csv');
  return _round2Map;
}

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ── Public API ─────────────────────────────────────────────────────────

export function loadElections(
  departementCode: string | null | undefined,
  circo: number | null | undefined,
): ElectionResult | null {
  if (!departementCode || !circo) return null;

  const key = buildKeyFromDB(departementCode, circo);
  const round1Row = getRound1Map().get(key);
  if (!round1Row) return null;

  const round2Row = getRound2Map().get(key) ?? null;

  const round2Names = new Set<string>();
  if (round2Row) {
    for (const c of round2Row.candidates) {
      round2Names.add(normaliseName(c.nom));
    }
  }

  const round1: ElectionRound = {
    round: 1,
    inscrits: round1Row.inscrits,
    votants: round1Row.votants,
    pctVotants: round1Row.pctVotants,
    exprimes: round1Row.exprimes,
    blancs: round1Row.blancs,
    nuls: round1Row.nuls,
    candidates: round1Row.candidates.map((c) => ({
      ...c,
      qualifie: round2Row !== null && round2Names.has(normaliseName(c.nom)),
    })),
  };

  const round2: ElectionRound | null = round2Row
    ? {
        round: 2,
        inscrits: round2Row.inscrits,
        votants: round2Row.votants,
        pctVotants: round2Row.pctVotants,
        exprimes: round2Row.exprimes,
        blancs: round2Row.blancs,
        nuls: round2Row.nuls,
        candidates: round2Row.candidates.map((c) => ({ ...c, qualifie: false })),
      }
    : null;

  return {
    departementNom: round1Row.departementNom,
    circoLabel: round1Row.circoLabel,
    round1,
    round2,
  };
}
