import { useState } from "preact/hooks";
import { Notice, Screen } from "../ui";

interface Props {
  initialName: string;
  initialCode: string;
  message: string | null;
  busy: boolean;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
}

export function Home({ initialName, initialCode, message, busy, onCreate, onJoin }: Props) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  return (
    <Screen>
      <h1>Pick 7 scorekeeper</h1>
      <p class="lede">For Flip 7: With a Vengeance. Private totals. Nobody sees your score until the game ends.</p>
      {message && (
        <p class="alert" role="alert">
          {message}
        </p>
      )}
      <div class="stack">
        <label class="field">
          Your name
          <input value={name} maxLength={20} autoComplete="off" onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <button class="big" disabled={busy} onClick={() => onCreate(name)}>
          Create game
        </button>
        <div class="list pad">
          <label class="field">
            Room code
            <input
              value={code}
              maxLength={4}
              autoComplete="off"
              autoCapitalize="characters"
              class="code-input"
              onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
            />
          </label>
          <button class="big alt" disabled={busy} onClick={() => onJoin(code, name)}>
            Join game
          </button>
        </div>
      </div>
      <Notice />
    </Screen>
  );
}
