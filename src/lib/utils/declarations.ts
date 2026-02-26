/**
 * Pure formatting utilities for declaration display.
 * Safe for client-side import (lives in $lib/utils/, not $lib/server/).
 */

const PRIVATE_MARKER = '[Données non publiées]';

/** Returns true if the string is the HATVP private-data placeholder. */
export function isPrivate(s: string | null | undefined): boolean {
  if (!s) return false;
  return s.trim() === PRIVATE_MARKER;
}

/** Format a period from MM/YYYY strings. Empty fin means "en cours". */
export function formatPeriod(debut: string, fin: string): string {
  if (!debut && !fin) return '';
  const start = debut || '?';
  const end = fin || 'en cours';
  return `${start} \u2192 ${end}`;
}

/** Normalise an amount string: strip spaces, parse as integer, format with non-breaking space thousands separator. */
export function formatAmount(s: string | null | undefined): string {
  if (!s) return '0';
  const n = parseInt(s.replace(/\s/g, ''), 10);
  if (isNaN(n)) return '0';
  return n.toLocaleString('fr-FR');
}

/** Returns true if all annual amounts in a remuneration are zero or absent. */
export function isZeroRemuneration(montants: Array<{ annee: number; montant: string }> | null | undefined): boolean {
  if (!montants || montants.length === 0) return true;
  return montants.every((m) => {
    const n = parseInt(m.montant.replace(/\s/g, ''), 10);
    return isNaN(n) || n === 0;
  });
}
