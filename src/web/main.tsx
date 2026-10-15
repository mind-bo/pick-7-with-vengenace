import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { ErrorCode } from "../shared/protocol";
import { Connection, loadToken, saveToken, type ConnState } from "./conn";
import { MESSAGES } from "./messages";
import { Entry } from "./screens/Entry";
import { Final } from "./screens/Final";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";
import { Waiting } from "./screens/Waiting";
import "./styles.css";
import { Notice, Screen } from "./ui";

interface Session {
  code: string;
  /** The name to join with. Null when the phone already holds a token for this room. */
  joinName: string | null;
}

const NOTICE_MS = 4000;
/** After these errors the Home screen keeps the room code and the name, so the player can fix them and try again. */
const KEEP_CODE = new Set<string>(["BAD_NAME", "NAME_TAKEN", "ROOM_FULL", "GAME_STARTED"]);

function roomFromUrl(): string {
  return (new URLSearchParams(location.search).get("room") ?? "").trim().toUpperCase().slice(0, 4);
}

function setUrlRoom(code: string | null): void {
  const url = new URL(location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  history.replaceState(null, "", url);
}

/** A phone with a saved token for the room in the link goes straight back into the room. */
function initialSession(): Session | null {
  const code = roomFromUrl();
  return code && loadToken(code) ? { code, joinName: null } : null;
}

function App() {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [conn, setConn] = useState<Connection | null>(null);
  const [state, setState] = useState<ConnState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [homeCode, setHomeCode] = useState(roomFromUrl);
  const [homeName, setHomeName] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!session) {
      setConn(null);
      setState(null);
      return;
    }
    const c = new Connection(session.code, session.joinName);
    setConn(c);
    setState(c.state);
    const off = c.subscribe(setState);
    return () => {
      off();
      c.close();
    };
  }, [session]);

  // A session that cannot continue returns the player to Home with the reason.
  useEffect(() => {
    if (!state?.fatal || !session) return;
    setMessage(MESSAGES[state.fatal]);
    const keep = KEEP_CODE.has(state.fatal);
    setHomeCode(keep ? session.code : "");
    setUrlRoom(keep ? session.code : null);
    setSession(null);
  }, [state?.fatal]);

  useEffect(() => {
    if (!state?.notice || !conn) return;
    const timer = setTimeout(() => conn.clearNotice(), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [state?.notice]);

  const view = state?.view ?? null;
  const round = view?.phase === "playing" ? view.round : 0;
  useEffect(() => setEditing(false), [round]);

  const create = async (name: string) => {
    setBusy(true);
    setMessage(null);
    setHomeName(name);
    try {
      const res = await fetch("/api/rooms", { method: "POST", body: JSON.stringify({ name }) });
      const body = (await res.json()) as { code?: string; token?: string; error?: ErrorCode };
      if (!res.ok || !body.code || !body.token) {
        setMessage(MESSAGES[body.error ?? "BAD_STATE"] ?? "Could not create the game. Try again.");
        return;
      }
      saveToken(body.code, body.token);
      setUrlRoom(body.code);
      setSession({ code: body.code, joinName: null });
    } catch {
      setMessage("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const join = (rawCode: string, rawName: string) => {
    const code = rawCode.trim().toUpperCase();
    const name = rawName.trim();
    setHomeName(rawName);
    if (code.length !== 4) return setMessage(MESSAGES.ROOM_NOT_FOUND);
    if (!loadToken(code) && name === "") return setMessage(MESSAGES.BAD_NAME);
    setMessage(null);
    setUrlRoom(code);
    setSession({ code, joinName: name });
  };

  if (!session) {
    return <Home initialName={homeName} initialCode={homeCode} message={message} busy={busy} onCreate={create} onJoin={join} />;
  }
  if (!view || !conn) {
    return (
      <Screen>
        <p class="lede">Connecting…</p>
        <Notice />
      </Screen>
    );
  }

  return (
    <>
      {!state?.connected && (
        <div class="banner" role="status">
          Reconnecting…
        </div>
      )}
      {view.phase === "lobby" && <Lobby view={view} send={(c) => conn.send(c)} />}
      {view.phase === "playing" &&
        (view.yourEntry && !editing ? (
          <Waiting view={view} send={(c) => conn.send(c)} onEdit={() => setEditing(true)} />
        ) : (
          <Entry key={`${view.round}:${editing}`} view={view} send={(c) => conn.send(c)} onSubmitted={() => setEditing(false)} />
        ))}
      {view.phase === "finished" && <Final view={view} />}
      {state?.notice && (
        <div class="toast" role="alert">
          {MESSAGES[state.notice]}
        </div>
      )}
    </>
  );
}

render(<App />, document.getElementById("app")!);
