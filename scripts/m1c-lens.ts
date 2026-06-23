// Integration checks for Module 1 Phase C — lens resolution (pure, no DB).
// Asserts the scope matrix: single locked to teamRole default (explicit ignored);
// multi/all honour a valid explicit; invalid explicit throws (→ 400 at the route).
// Run: npx tsx scripts/m1c-lens.ts   (exits 1 on any failure)
import { resolveLens } from "@/lib/lens";
import { StudioError } from "@/lib/studio-error";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

function expectThrow(name: string, status: number, fn: () => unknown) {
  try {
    fn();
    ok(`${name} (expected StudioError ${status})`, false);
  } catch (e) {
    ok(name, e instanceof StudioError && e.status === status);
  }
}

function main() {
  // teamRole defaults
  ok("single marketing → marketing", resolveLens({ teamRole: "marketing", team: "single" }) === "marketing");
  ok("single creative → social", resolveLens({ teamRole: "creative", team: "single" }) === "social");

  // single ignores explicit (locked to default)
  ok("single creative + explicit marketing → social (locked)",
    resolveLens({ teamRole: "creative", team: "single" }, "marketing") === "social");
  ok("single marketing + explicit social → marketing (locked)",
    resolveLens({ teamRole: "marketing", team: "single" }, "social") === "marketing");

  // multi/all honour valid explicit
  ok("multi creative + explicit marketing → marketing",
    resolveLens({ teamRole: "creative", team: "multi" }, "marketing") === "marketing");
  ok("all marketing + explicit social → social",
    resolveLens({ teamRole: "marketing", team: "all" }, "social") === "social");

  // multi/all without explicit → teamRole default
  ok("multi creative, no explicit → social",
    resolveLens({ teamRole: "creative", team: "multi" }) === "social");
  ok("all marketing, no explicit → marketing",
    resolveLens({ teamRole: "marketing", team: "all" }) === "marketing");

  // invalid explicit → 400 (even for an admin who is otherwise allowed to pick)
  expectThrow("invalid explicit lens → 400", 400, () => resolveLens({ teamRole: "marketing", team: "all" }, "boss"));

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main();
