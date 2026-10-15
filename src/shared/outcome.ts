import { TARGET } from "./score";

export type PlayerId = string; // server-generated, opaque

export interface Outcome {
  finished: boolean;
  winners: readonly PlayerId[];
  ranks: Readonly<Record<PlayerId, number>>;
}

export function outcome(totals: Readonly<Record<PlayerId, number>>): Outcome {
  const ids = Object.keys(totals);
  const max = Math.max(...ids.map((id) => totals[id]!));
  const finished = max >= TARGET;
  const ranks: Record<PlayerId, number> = {};
  for (const id of ids) ranks[id] = 1 + ids.filter((other) => totals[other]! > totals[id]!).length;
  return { finished, winners: finished ? ids.filter((id) => totals[id] === max) : [], ranks };
}
