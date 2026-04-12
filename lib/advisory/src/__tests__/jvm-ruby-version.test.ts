import { describe, expect, it } from "vitest";
import {
  extractConcreteVersion,
  getProviderEcosystem,
  isLockfileSource
} from "../version.js";

describe("JVM and Ruby advisory version helpers", () => {
  it("maps shared ecosystems to Maven and RubyGems provider names", () => {
    expect(getProviderEcosystem("jvm")).toBe("Maven");
    expect(getProviderEcosystem("ruby")).toBe("RubyGems");
  });

  it("extracts exact JVM and Ruby versions and rejects heuristic ranges", () => {
    expect(extractConcreteVersion({ ecosystem: "jvm", version: "6.1.15" })).toBe("6.1.15");
    expect(extractConcreteVersion({ ecosystem: "jvm", version: "${spring.version}" })).toBeNull();
    expect(extractConcreteVersion({ ecosystem: "ruby", version: "7.1.5" })).toBe("7.1.5");
    expect(extractConcreteVersion({ ecosystem: "ruby", version: "~> 7.1.5" })).toBeNull();
  });

  it("treats JVM and Ruby lockfiles as resolved-version sources", () => {
    expect(isLockfileSource("gradle.lockfile")).toBe(true);
    expect(isLockfileSource("nested/Gemfile.lock")).toBe(true);
  });
});
