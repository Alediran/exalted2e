/**
 * Quench test-harness entry point.
 *
 * Loaded conditionally from module/exalted2e.mjs only when the Quench
 * module is active. Registers each test batch via Quench's `quenchReady`
 * hook. Do NOT import this file outside of that gated path — it pulls in
 * the helper layer and test fixtures that the production runtime doesn't
 * need.
 */

import { registerKnockbackFocused } from "./combat/knockback-focused.mjs";
import { registerKnockbackSmoke }   from "./combat/knockback-smoke.mjs";

Hooks.once("quenchReady", quench => {
  quench.registerBatch(
    "ex2e.knockback.focused",
    registerKnockbackFocused,
    { displayName: "Knockback (focused)" }
  );
  quench.registerBatch(
    "ex2e.knockback.smoke",
    registerKnockbackSmoke,
    { displayName: "Knockback (smoke)" }
  );
});
