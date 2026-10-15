import type { PlayerId } from "./outcome";
import type { Entry, EntryError, RoundScore } from "./score";

export type Command =
  | { t: "join"; name: string }
  | { t: "start" }
  | { t: "submit"; round: number; entry: unknown }
  | { t: "remove"; playerId: PlayerId };

export type ErrorCode =
  | EntryError
  | "BAD_NAME"
  | "NAME_TAKEN"
  | "ROOM_FULL"
  | "GAME_STARTED"
  | "NEED_3_PLAYERS"
  | "HOST_ONLY"
  | "STALE_ROUND"
  | "NOT_IN_ROOM"
  | "BAD_STATE"
  | "REMOVED";

/** RosterItem has no score field by design: PV1 and WT2 are enforced by the type. */
export interface RosterItem {
  id: PlayerId;
  name: string;
  isHost: boolean;
  status: "entering" | "submitted" | "offline";
}

export type View =
  | { phase: "lobby"; code: string; you: PlayerId; players: RosterItem[]; canStart: boolean }
  | {
      phase: "playing";
      code: string;
      you: PlayerId;
      round: number;
      players: RosterItem[];
      submittedCount: number;
      yourEntry: Entry | null;
      yourScore: RoundScore | null;
      yourTotal: number; // through the last LOCKED round
      yourHistory: { round: number; score: number }[];
    }
  | {
      phase: "finished";
      code: string;
      you: PlayerId;
      winners: PlayerId[];
      ranking: { id: PlayerId; name: string; total: number; rank: number }[];
      rounds: { number: number; cells: Record<PlayerId, { score: number; kind: "bust" | "flip7" | "normal" }> }[];
    };

export type ServerMsg =
  | { t: "joined"; token: string } // sent once, to the joining socket
  | { t: "view"; view: View }
  | { t: "error"; code: ErrorCode };
