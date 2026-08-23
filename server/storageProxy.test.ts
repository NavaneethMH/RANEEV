import { describe, expect, it } from "vitest";
import { parseStorageKey } from "./_core/storageProxy";

describe("parseStorageKey", () => {
  it("preserves valid named Express wildcard segments", () => {
    expect(parseStorageKey(["incident-assets", "map.png"])).toBe("incident-assets/map.png");
    expect(parseStorageKey("raneev-route-texture.jpg")).toBe("raneev-route-texture.jpg");
  });

  it("rejects missing, empty, absolute, and traversal paths", () => {
    expect(parseStorageKey(undefined)).toBeUndefined();
    expect(parseStorageKey("")).toBeUndefined();
    expect(parseStorageKey("/private/object")).toBeUndefined();
    expect(parseStorageKey(["incident-assets", "..", "secret"])).toBeUndefined();
    expect(parseStorageKey(["incident-assets", "", "map.png"])).toBeUndefined();
  });
});
