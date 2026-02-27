// Colour palette for political nuance codes from the official election CSV.
// All colours chosen to match the official party/coalition visual identity.
const NUANCE_COLOURS: Record<string, string> = {
  RN: '#073689', // Rassemblement National — dark navy blue
  ENS: '#7B2D8B', // Ensemble pour la République (Renaissance) — violet
  UG: '#CC0044', // Union de la Gauche / NFP — crimson red
  LR: '#0070BB', // Les Républicains — classic blue
  EXG: '#8B0000', // Extrême Gauche — dark red
  EXD: '#1B1464', // Extrême Droite — very dark navy
  DVG: '#E75480', // Divers Gauche — rose pink
  DVD: '#4169E1', // Divers Droite — royal blue
  DVC: '#FF8C00', // Divers Centre — amber
  DIV: '#757575', // Divers — neutral grey
  DSV: '#9E9E9E', // Divers société civile — light grey
  UXD: '#0D0D3D', // Union eXtrême Droite — near black
  UDI: '#00838F', // Union Démocrates Indépendants — teal
  REC: '#0D1B2A', // Reconquête — near black-blue
  ECO: '#2E7D32', // Écologistes — forest green
  REG: '#00695C', // Régionalistes — dark teal
  RDG: '#B03060', // Rassemblement Démocratique Gauche — maroon rose
};

const DEFAULT_NUANCE_COLOUR = '#9E9E9E';

export function getNuanceColour(nuance: string): string {
  return NUANCE_COLOURS[nuance] ?? DEFAULT_NUANCE_COLOUR;
}

// Human-readable labels for nuance codes
const NUANCE_LABELS: Record<string, string> = {
  RN: 'Rassemblement National',
  ENS: 'Ensemble pour la République',
  UG: 'Union de la Gauche (NFP)',
  LR: 'Les Républicains',
  EXG: 'Extrême Gauche',
  EXD: 'Extrême Droite',
  DVG: 'Divers Gauche',
  DVD: 'Divers Droite',
  DVC: 'Divers Centre',
  DIV: 'Divers',
  DSV: 'Divers société civile',
  UXD: 'Union Extrême Droite',
  UDI: 'Union Démocrates Indépendants',
  REC: 'Reconquête',
  ECO: 'Écologistes',
  REG: 'Régionalistes',
  RDG: 'Rassemblement Démocratique Gauche',
};

export function getNuanceLabel(nuance: string): string {
  return NUANCE_LABELS[nuance] ?? nuance;
}

export function formatVoix(voix: number): string {
  return voix.toLocaleString('fr-FR');
}

export function formatPct(pct: number): string {
  return pct.toFixed(2).replace('.', ',') + '\u00a0%';
}
