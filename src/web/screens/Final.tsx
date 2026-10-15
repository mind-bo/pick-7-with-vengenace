import type { View } from "../../shared/protocol";
import { Notice, Screen } from "../ui";

type FinalView = Extract<View, { phase: "finished" }>;

export function Final({ view }: { view: FinalView }) {
  const nameOf = (id: string) => view.ranking.find((r) => r.id === id)?.name ?? "";
  const top = view.ranking[0]?.total ?? 0;
  return (
    <Screen>
      <div class="win">
        <span>{view.winners.length > 1 ? "Co-winners" : "Winner"}</span>
        <b>{view.winners.map(nameOf).join(" & ")}</b>
        {top} points
      </div>
      <ul class="list">
        {view.ranking.map((r) => (
          <li key={r.id}>
            <span>
              {r.rank}. {r.name}
              {r.id === view.you && <span class="tag">you</span>}
            </span>
            <b>{r.total}</b>
          </li>
        ))}
      </ul>
      <h3>Round by round</h3>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th />
              {view.rounds.map((r) => (
                <th key={r.number}>R{r.number}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {view.ranking.map((p) => (
              <tr key={p.id}>
                <td class="left">{p.name}</td>
                {view.rounds.map((r) => {
                  const cell = r.cells[p.id];
                  return (
                    <td key={r.number}>
                      {cell?.score}
                      {cell?.kind === "bust" && <span class="m">bust</span>}
                      {cell?.kind === "flip7" && <span class="m">Flip 7</span>}
                    </td>
                  );
                })}
                <td>
                  <b>{p.total}</b>
                </td>
              </tr>
            ))}
          </tbody>
      </table>
      </div>
      <Notice />
    </Screen>
  );
}
