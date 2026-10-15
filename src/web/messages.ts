import type { ErrorCode } from "../shared/protocol";

/** Text for each error code that a phone can see. */
export const MESSAGES: Record<ErrorCode | "ROOM_NOT_FOUND" | "OFFLINE", string> = {
  ROOM_NOT_FOUND: "Room not found. Check the code.",
  OFFLINE: "Not connected yet. Wait for Reconnecting… to clear, then try again.",
  BAD_NAME: "Enter a name of 1 to 20 characters.",
  NAME_TAKEN: "That name is taken in this room. Pick another name.",
  ROOM_FULL: "This room is full (12 players).",
  GAME_STARTED: "This game already started. Only players who joined before can come back.",
  NEED_3_PLAYERS: "A game needs at least 3 players.",
  HOST_ONLY: "Only the host can do that.",
  STALE_ROUND: "That round is over. Your screen is updating.",
  NOT_IN_ROOM: "You are not in this room.",
  BAD_STATE: "That action is not possible now.",
  REMOVED: "The host removed you from the game.",
  MALFORMED: "Your hand could not be sent. Check your cards and try again.",
  BAD_CARD: "Your hand could not be sent. Check your cards and try again.",
  DUPLICATE_CARD: "Your hand could not be sent. Check your cards and try again.",
  TOO_MANY_CARDS: "A hand holds at most 7 cards.",
  SECOND_13_NEEDS_LUCKY: "A second 13 needs Lucky 13.",
  LUCKY_NEEDS_13: "Lucky 13 needs a 13 in the hand.",
  BAD_MODIFIER: "Your hand could not be sent. Check your cards and try again.",
  DUPLICATE_MODIFIER: "Your hand could not be sent. Check your cards and try again.",
};
