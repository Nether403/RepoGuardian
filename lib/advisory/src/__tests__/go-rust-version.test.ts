import { describe, expect, it } from "vitest";
import {
  extractConcreteVersion,
  getProviderEcosystem,
  isLockfileSource
} from "../version.js";

describe("Go and Rust advisory version helpers", () => {
  it("maps shared ecosystems to Go and crates.io provider names", () => {
    expect(getProviderEcosystem("go")).toBe("Go");
    expect(getProviderEcosystem("rust")).toBe("crates.io");
  });

  it("extracts exact Go and Rust versions and rejects declaration-only ranges", () => {
    expect(extractConcreteVersion({ ecosystem: "go", version: "v1.10.0" })).toBe("v1.10.0");
    expect(extractConcreteVersion({ ecosystem: "go", version: ">=1.10.0" })).toBeNull();
    expect(extractConcreteVersion({ ecosystem: "rust", version: "1.0.215" })).toBe("1.0.215");
    expect(extractConcreteVersion({ ecosystem: "rust", version: "^1.0.215" })).toBeNull();
  });

  it("treats Go and Rust lockfiles as resolved-version sources", () => {
    expect(isLockfileSource("go.sum")).toBe(true);
    expect(isLockfileSource("nested/Cargo.lock")).toBe(true);
  });
});
