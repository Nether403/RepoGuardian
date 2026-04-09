import { describe, expect, it } from "vitest";
import { extractConcreteVersion, getProviderEcosystem, isLockfileSource } from "../version.js";

describe("advisory version helpers", () => {
  it("maps supported ecosystems to provider ecosystems", () => {
    expect(getProviderEcosystem("node")).toBe("npm");
    expect(getProviderEcosystem("python")).toBe("PyPI");
    expect(getProviderEcosystem("go")).toBe("Go");
    expect(getProviderEcosystem("rust")).toBe("crates.io");
    expect(getProviderEcosystem("jvm")).toBe("Maven");
    expect(getProviderEcosystem("ruby")).toBe("RubyGems");
  });

  it("extracts concrete versions for the expanded ecosystem set", () => {
    expect(extractConcreteVersion({ ecosystem: "node", version: "19.0.0" })).toBe("19.0.0");
    expect(extractConcreteVersion({ ecosystem: "python", version: "==2.32.3" })).toBe("2.32.3");
    expect(extractConcreteVersion({ ecosystem: "go", version: "v1.10.0" })).toBe("v1.10.0");
    expect(extractConcreteVersion({ ecosystem: "rust", version: "1.0.215" })).toBe("1.0.215");
    expect(extractConcreteVersion({ ecosystem: "jvm", version: "6.1.15" })).toBe("6.1.15");
    expect(extractConcreteVersion({ ecosystem: "ruby", version: "7.1.5" })).toBe("7.1.5");
    expect(extractConcreteVersion({ ecosystem: "jvm", version: "${spring.version}" })).toBeNull();
    expect(extractConcreteVersion({ ecosystem: "ruby", version: "~> 7.1.5" })).toBeNull();
  });

  it("recognizes the expanded lockfile set for advisory scoring", () => {
    expect(isLockfileSource("Cargo.lock")).toBe(true);
    expect(isLockfileSource("Gemfile.lock")).toBe(true);
    expect(isLockfileSource("Pipfile.lock")).toBe(true);
    expect(isLockfileSource("go.sum")).toBe(true);
    expect(isLockfileSource("gradle.lockfile")).toBe(true);
    expect(isLockfileSource("yarn.lock")).toBe(true);
    expect(isLockfileSource("package.json")).toBe(false);
  });
});
