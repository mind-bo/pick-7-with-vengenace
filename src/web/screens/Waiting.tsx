import { useState } from "preact/hooks";
import type { Command, View } from "../../shared/protocol";
import { ConfirmDialog, Notice, Screen } from "../ui";

type PlayingView = Extract<View, { phase: "playing" }>;

const STATUS = { submitted: "✓ Submitted", entering: "✎ Entering", offline: "○ Offline" } as const;

interface Props {
  view: PlayingView;
  send: (cmd: Command) => void;
  onEdit: () => void;
}

export function Waiting({ view, send, onEdit }: Props) {
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const isHost = view.players.find((p) => p.id === view.you)?.isHost === true;
  return (
    <Screen>
      <h1>Submitted</h1>
      <p class="lede">
        This round: <b>{view.yourScore?.value ?? 0}</b> · Your total so far: <b>{view.yourTotal}</b> (updates at lock)
      </p>
      <h3>
        {view.submittedCount} of {view.players.length} submitted
      </h3>
      <ul class="list">
        {view.players.map((p) => (
          <li key={p.id}>
            <span class="who">
              <span class="name">{p.name}</span>
              {p.id === view.you && <span class="tag">you</span>}
            </span>
            <span class="right">
              <span class="tag">{STATUS[p.status]}</span>
              {isHost && !p.isHost && (
                <button class="ghost warn small" onClick={() => setRemoving({ id: p.id, name: p.name })}>
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div class="actions">
        <button class="ghost" onClick={onEdit}>
          Edit my hand
        </button>
        <span />
      </div>
      <Notice />
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          body="This player leaves the game, and past rounds lose their scores. The game needs at least 3 players."
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
