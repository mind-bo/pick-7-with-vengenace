// Run: node check-score.cjs
// Checks the prototype scoring against ACCEPTANCE_CRITERIA.md section 1.
const { scoreEntry } = require("./score.proto.js");
const h = (numbers, o = {}) => ({ numbers, lucky13: false, second13: false, minus: [], halve: false, ...o });
const cases = [
  ["S01", h([1, 3, 4, 5, 10, 12, 13], { halve: true, minus: [4] }), 35],
  ["S02", h([10, 12, 13], { halve: true, minus: [4] }), 13],
  ["S03", h([5, 9], { minus: [10] }), 4],
  ["S04", h([2, 3], { minus: [10] }), 0],
  ["S05", h([0, 4, 9]), 0],
  ["S06", h([0, 1, 2, 3, 4, 5, 6]), 36],
  ["S07", h([0, 1, 2, 3, 4, 5, 6], { minus: [2, 4, 6, 8, 10] }), 15],
  ["S08", { bust: true }, 0],
  ["S09", h([7], { halve: true }), 3],
  ["S10", h([10, 13], { lucky13: true, second13: true }), 36],
  ["S11", h([1, 2, 3, 4, 5, 13], { lucky13: true, second13: true }), 56],
  ["S12", h([0, 1, 2, 3, 4, 5, 6], { halve: true }), 25],
  ["S13", h([10], { halve: true, minus: [4] }), 1],
  ["S14", h([3], { halve: true, minus: [2] }), 0],
  ["S15", h([], { halve: true, minus: [4] }), 0],
];
let bad = 0;
for (const [id, e, want] of cases) {
  const got = scoreEntry(e).value;
  if (got !== want) { bad++; console.log("FAIL", id, "want", want, "got", got); }
}
if (scoreEntry(h([0, 1, 2, 3, 4, 5, 6])).kind !== "flip7") { bad++; console.log("FAIL S16 kind"); }
console.log(bad ? bad + " failed" : "all " + (cases.length + 1) + " checks passed");
process.exit(bad ? 1 : 0);
