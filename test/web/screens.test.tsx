import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";
import type { View } from "../../src/shared/protocol";
import { Entry } from "../../src/web/screens/Entry";
import { Final } from "../../src/web/screens/Final";
import { Home } from "../../src/web/screens/Home";
import { Lobby } from "../../src/web/screens/Lobby";
import { Waiting } from "../../src/web/screens/Waiting";
import { NOTICE } from "../../src/web/ui";

const EVIL = "<img src=x onerror=alert(1)>";

const root = document.createElement("div");
document.body.appendChild(root);
afterEach(() => render(null, root));

const lobby: Extract<View, { phase: "lobby" }> = {
  phase: "lobby",
  code: "K7QF",
  you: "a",
  canStart: true,
  players: [
    { id: "a", name: EVIL, isHost: true, status: "entering" },
    { id: "b", name: "Sam", isHost: false, status: "offline" },
    { id: "c", name: "Lee", isHost: false, status: "entering" },
  ],
};

const playing: Extract<View, { phase: "playing" }> = {
  phase: "playing",
  code: "K7QF",
  you: "a",
  round: 2,
  players: lobby.players,
  submittedCount: 1,
  yourEntry: null,
  yourScore: null,
  yourTotal: 40,
  yourHistory: [{ round: 1, score: 40 }],
};

const finished: Extract<View, { phase: "finished" }> = {
  phase: "finished",
  code: "K7QF",
  you: "a",
  winners: ["a"],
  ranking: [
    { id: "a", name: EVIL, total: 210, rank: 1 },
    { id: "b", name: "Sam", total: 100, rank: 2 },
  ],
  rounds: [{ number: 1, cells: { a: { score: 210, kind: "flip7" }, b: { score: 0, kind: "bust" } } }],
};

const noop = () => {};
const sent = () => true;

describe("names are plain text", () => {
  it("AC-N04: the lobby shows a markup name as literal text", () => {
    render(<Lobby view={lobby} send={noop} />, root);
    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain(EVIL);
  });

  it("AC-N04: the final screen shows a markup name as literal text", () => {
    render(<Final view={finished} />, root);
    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain(EVIL);
  });

  it("the waiting screen shows a markup name as literal text", () => {
    render(<Waiting view={playing} send={noop} onEdit={noop} />, root);
    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain(EVIL);
  });
});

describe("every screen carries the unofficial notice", () => {
  const screens: [string, () => preact.VNode][] = [
    ["Home", () => <Home initialName="" initialCode="" message={null} busy={false} onCreate={noop} onJoin={noop} />],
    ["Lobby", () => <Lobby view={lobby} send={noop} />],
    ["Entry", () => <Entry view={playing} send={sent} onSubmitted={noop} />],
    ["Waiting", () => <Waiting view={playing} send={noop} onEdit={noop} />],
    ["Final", () => <Final view={finished} />],
  ];
  it.each(screens)("AC-N03: %s", (_name, make) => {
    render(make(), root);
    expect(root.textContent).toContain(NOTICE);
  });
});

describe("Final", () => {
  it("marks a bust and a Flip 7 in the rounds table", () => {
    render(<Final view={finished} />, root);
    const marks = [...root.querySelectorAll("td .m")].map((n) => n.textContent);
    expect(marks).toEqual(["Flip 7", "bust"]);
  });

  it("shows Co-winners for a tie", () => {
    render(<Final view={{ ...finished, winners: ["a", "b"] }} />, root);
    expect(root.querySelector(".win")?.textContent).toContain("Co-winners");
  });
});

describe("Entry", () => {
  it("AC-H10 and HE10: shows the help lines and the duplicate-number note", () => {
    render(<Entry view={playing} send={sent} onSubmitted={noop} />, root);
    const text = root.textContent ?? "";
    for (const part of ["The Zero:", "Unlucky 7:", "Lucky 13:", "Drew a number you already hold? That is a bust. Tap I busted."]) {
      expect(text).toContain(part);
    }
  });

  it("starts with the empty-hand label, and the Submit button shows the working's score", () => {
    render(<Entry view={playing} send={sent} onSubmitted={noop} />, root);
    expect(root.querySelector(".primary")?.textContent).toBe("Submit 0 (no cards)");
  });
});
