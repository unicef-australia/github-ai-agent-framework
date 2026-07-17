import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { greet } from "../src/greet.js";

describe("greet", () => {
  it("greets a caller by name", () => {
    assert.equal(greet("Ada"), "Hello, Ada!");
  });

  it("rejects a blank name", () => {
    assert.throws(() => greet("  "), TypeError);
  });
});
