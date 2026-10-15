// PROTOTYPE scoring. Throwaway port of the scoring order in ../ARCHITECTURE.md.
// Order (GAME_CONTEXT.md section 5): bust, sum, The Zero, halve, minus, floor, Flip 7 bonus.
(function (root) {
  function scoreEntry(e) {
    if (e.bust) return { value: 0, kind: "bust", steps: [{ op: "bust", before: 0, after: 0 }] };
    const nums = [...e.numbers];
    const terms = e.second13 ? nums.concat(13) : nums;
    terms.sort((a, b) => b - a);
    const flip7 = terms.length === 7;
    let s = terms.reduce((a, b) => a + b, 0);
    const steps = [{ op: "sum", terms, before: 0, after: s }];
    if (nums.includes(0) && !flip7) {
      steps.push({ op: "zero", before: s, after: 0 });
      return { value: 0, kind: "normal", steps };
    }
    if (e.halve) {
      const a = Math.floor(s / 2);
      steps.push({ op: "halve", before: s, after: a });
      s = a;
    }
    [...e.minus].sort((a, b) => a - b).forEach((m) => {
      steps.push({ op: "minus", m, before: s, after: s - m });
      s -= m;
    });
    if (s < 0) {
      steps.push({ op: "floor", before: s, after: 0 });
      s = 0;
    }
    if (flip7) {
      steps.push({ op: "flip7", before: s, after: s + 15 });
      s += 15;
    }
    return { value: s, kind: flip7 ? "flip7" : "normal", steps };
  }

  function formatWorking(r) {
    return r.steps
      .map((st) => {
        switch (st.op) {
          case "bust": return "Bust = 0";
          case "sum": return st.terms.length === 0 ? "No cards = 0" : st.terms.length === 1 ? String(st.after) : st.terms.join(" + ") + " = " + st.after;
          case "zero": return "The Zero = 0";
          case "halve": return "÷2 = " + st.after;
          case "minus": return "−" + st.m + " = " + st.after;
          case "floor": return "floor 0";
          case "flip7": return "Flip 7 +15 = " + st.after;
        }
      })
      .join(" → ");
  }

  const api = { scoreEntry, formatWorking };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.P7 = api;
})(this);
