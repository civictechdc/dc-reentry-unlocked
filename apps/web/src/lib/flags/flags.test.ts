import { describe, expect, test, vi } from "vitest";
import {
  buildFlagDefines,
  FEATURE_FLAGS,
  flagDefineEnv,
  flagDefineKey,
  flagEnvKey,
  type FeatureFlag,
  isDevServerRun,
} from "./registry";

// The override module parses location.search once, at module load; the
// parsing tests below use the pure parser directly. The gate test manages
// its own module instance (mocked registry, stubbed dev-server global).
const { parseFlagOverrides } = await import("./index");

describe("flag name derivations", () => {
  test("derives the command-time environment key from a kebab-case flag name", () => {
    expect(flagEnvKey("w1-map-zoom")).toBe("VITE_FEATURE_W1_MAP_ZOOM");
  });

  test("derives the compile-time define key from a kebab-case flag name", () => {
    expect(flagDefineKey("w1-map-zoom")).toBe("__FLAG_W1_MAP_ZOOM__");
  });
});

describe("page-load flag override parsing", () => {
  test("reads a comma-separated list of registered flag names", () => {
    const overrides = parseFlagOverrides("?flags=map-zoom,tour-cards", ["map-zoom", "tour-cards"]);

    expect(overrides.has("map-zoom")).toBe(true);
    expect(overrides.has("tour-cards")).toBe(true);
  });

  test("ignores flag names that are not registered", () => {
    const overrides = parseFlagOverrides("?flags=map-zoom,ghost-flag", ["map-zoom"]);

    expect(overrides.has("map-zoom")).toBe(true);
    expect(overrides.has("ghost-flag")).toBe(false);
    expect(overrides.size).toBe(1);
  });

  test("enables nothing when the override value is empty", () => {
    const overrides = parseFlagOverrides("?flags=", ["map-zoom"]);

    expect(overrides.size).toBe(0);
  });

  test("enables nothing when the override parameter is absent", () => {
    const overrides = parseFlagOverrides("?other=1", ["map-zoom"]);

    expect(overrides.size).toBe(0);
  });
});

describe("the dev-server-only override gate", () => {
  test("applies a page-load override on a dev-server run and refuses it in any build", async () => {
    // The registry is deliberately empty in committed source, so mock it to
    // carry the name: only then is the module-scope memo genuinely
    // populated and the negative below discriminating (without the mock it
    // would pass vacuously — absent name, refused for the wrong reason).
    // The cast reconciles the compile-time empty registry with the mocked
    // one.
    const nameFromUrl = "w1-map-zoom" as unknown as FeatureFlag;

    vi.resetModules();
    vi.doMock("./registry", () => ({ FEATURE_FLAGS: ["w1-map-zoom"] }));
    vi.stubGlobal("__DEV_SERVER__", true);
    window.history.replaceState(null, "", "/?flags=w1-map-zoom");
    try {
      const { hasFlagOverride: gated } = await import("./index");

      // Positive control: gate open + populated memo → true. Fails if the
      // mocked registry or the URL pin is broken.
      expect(gated(nameFromUrl)).toBe(true);

      // The gate refusing a POPULATED memo — the discriminating negative.
      vi.stubGlobal("__DEV_SERVER__", false);
      expect(gated(nameFromUrl)).toBe(false);
    } finally {
      window.history.replaceState(null, "", "/");
      vi.unstubAllGlobals();
      vi.doUnmock("./registry");
      vi.resetModules();
    }
  });
});

describe("the dev-server-only define environment gate", () => {
  const flagEnv = { VITE_FEATURE_MAP_ZOOM: "1" };

  test("hands the command-time environment to a dev-server run", () => {
    expect(flagDefineEnv("serve", "development", flagEnv)).toEqual(flagEnv);
  });

  test("gives a production-mode serve (a preview of built output) an empty environment", () => {
    expect(flagDefineEnv("serve", "production", flagEnv)).toEqual({});
  });

  test("gives every build an empty environment whatever its mode", () => {
    expect(flagDefineEnv("build", "production", flagEnv)).toEqual({});
  });

  test("keeps a development-mode build free of command-time flag variables", () => {
    // Regression pin: exporting the variable while building must not
    // enable flagged behavior in the built output.
    expect(flagDefineEnv("build", "development", flagEnv)).toEqual({});
  });

  test("passes through only VITE_FEATURE_ variables on a dev-server run", () => {
    const filtered = flagDefineEnv("serve", "development", {
      VITE_FEATURE_MAP_ZOOM: "1",
      PATH: "/usr/bin:/bin",
      GITHUB_TOKEN: "ghp_example",
    });

    expect(filtered).toEqual({ VITE_FEATURE_MAP_ZOOM: "1" });
  });

  test("drops everything, flag variables included, outside a dev-server run", () => {
    const filtered = flagDefineEnv("build", "production", {
      VITE_FEATURE_MAP_ZOOM: "1",
      PATH: "/usr/bin:/bin",
    });

    expect(filtered).toEqual({});
  });
});

describe("the dev-server predicate", () => {
  test("recognizes a dev-server run (serve in development mode)", () => {
    expect(isDevServerRun("serve", "development")).toBe(true);
  });

  test("refuses every other invocation, whatever its command or mode", () => {
    expect(isDevServerRun("serve", "production")).toBe(false);
    expect(isDevServerRun("build", "production")).toBe(false);
    expect(isDevServerRun("build", "development")).toBe(false);
  });
});

describe("command-time define building", () => {
  test("enables a flag whose command-time variable is set to 1", () => {
    const defines = buildFlagDefines(["map-zoom"], {
      VITE_FEATURE_MAP_ZOOM: "1",
    });

    expect(defines).toEqual({ __FLAG_MAP_ZOOM__: true });
  });

  test("leaves a flag off when its command-time variable is unset, 0, or not 1", () => {
    const unset = buildFlagDefines(["map-zoom"], {});
    const zero = buildFlagDefines(["map-zoom"], {
      VITE_FEATURE_MAP_ZOOM: "0",
    });
    const garbage = buildFlagDefines(["map-zoom"], {
      VITE_FEATURE_MAP_ZOOM: "enabled",
    });

    expect(unset).toEqual({ __FLAG_MAP_ZOOM__: false });
    expect(zero).toEqual({ __FLAG_MAP_ZOOM__: false });
    expect(garbage).toEqual({ __FLAG_MAP_ZOOM__: false });
  });

  test("builds no defines while the registry is empty", () => {
    const defines = buildFlagDefines(FEATURE_FLAGS, {
      VITE_FEATURE_ANYTHING: "1",
    });

    expect(defines).toEqual({});
  });
});
