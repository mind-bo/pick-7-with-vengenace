import { fromEntry, toRaw, type HandState } from "./hand";
import { parseEntry } from "../shared/score";

const key = (code: string, round: number) => `p7:draft:${code}:${round}`;

/** The unsent hand for this room and round, or null. A blocked or damaged store counts as no draft. */
export function loadDraft(code: string, round: number): HandState | null {
  try {
    const stored = localStorage.getItem(key(code, round));
    if (stored === null) return null;
    const parsed = parseEntry(JSON.parse(stored));
    return parsed.ok ? fromEntry(parsed.entry) : null;
  } catch {
    return null;
  }
}

export function saveDraft(code: string, round: number, hand: HandState): void {
  try {
    localStorage.setItem(key(code, round), JSON.stringify(toRaw(hand)));
  } catch {
    // The page works without a draft.
  }
}

export function clearDraft(code: string, round: number): void {
  try {
    localStorage.removeItem(key(code, round));
  } catch {
    // The page works without a draft.
  }
}
