import { fc, test } from "@fast-check/vitest";

// Scaffold property smoke: the property-based pipeline works end to end.
// Real schema properties arrive with block 3 (shared contracts).
test.prop({ n: fc.integer() })(
  "smoke integers are stably identified by identity comparison",
  ({ n }) => n === n,
);
