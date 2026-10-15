import { useState } from "preact/hooks";
import type { Command, View } from "../../shared/protocol";
import { ConfirmDialog, Notice, Screen } from "../ui";

type LobbyView = Extract<View, { phase: "lobby" }>;

interface Props {
  view: LobbyView;
  send: (cmd: Command) => void;
}

export function Lobby({ view, send }: Props) {
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const me = view.players.find((p) => p.id === view.you);
  const isHost = me?.isHost === true;
  const link = `${location.origin}/?room=${view.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // The link stays visible, so the player can copy it by hand.
    }
  };

  return (
    <Screen>
      <h1>Room {view.code}</h1>
      <p class="lede">
        Share the code or the link. {view.players.length} {view.players.length === 1 ? "player" : "players"} joined.
      </p>
      <ul class="list">
        {view.players.map((p) => (
          <li key={p.id}>
            <span class="who">
              <span class="name">{p.name}</span>
              {p.isHost && <span class="tag">host</span>}
              {p.id === view.you && <span class="tag">you</span>}
            </span>
            <span class="right">
              <span class="tag">{p.status === "offline" ? "○ Offline" : "● Online"}</span>
              {isHost && !p.isHost && (
                <button class="ghost warn small" onClick={() => setRemoving({ id: p.id, name: p.name })}>
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div class="linkrow">
        <input readOnly value={link} aria-label="Join link" onFocus={(e) => e.currentTarget.select()} />
        <button class="ghost" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div class="submit">
        {isHost ? (
          <>
            <button class="primary" disabled={!view.canStart} onClick={() => send({ t: "start" })}>
              Start game ({view.players.length} {view.players.length === 1 ? "player" : "players"})
            </button>
            {!view.canStart && <p class="note">Wait for at least 3 players.</p>}
          </>
        ) : (
          <p class="note center">Waiting for the host to start the game.</p>
        )}
      </div>
      <Notice />
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          body="This player leaves the game. The game needs at least 3 players."
          confirmLabel="Remove"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            send({ t: "remove", playerId: removing.id });
            setRemoving(null);
          }}
        />
      )}
    </Screen>
  );
}
