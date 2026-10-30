import { describe, expect, test } from "vitest";
import { OPENSTREETMAP_TILE_ORIGIN, securityCspDirectives } from "./csp";

describe("security CSP directives", () => {
  test("allows self script sources and keeps the tile server reachable", () => {
    const directives = securityCspDirectives({
      apiUrl: "http://localhost:3000",
      allowInlineScripts: false,
    });

    expect(directives["default-src"]).toEqual(["self"]);
    expect(directives["script-src"]).toContain("self");
    expect(directives["img-src"]).toContain(OPENSTREETMAP_TILE_ORIGIN);
    expect(directives["connect-src"]).toContain(OPENSTREETMAP_TILE_ORIGIN);
    // MapLibre runs its workers from blob URLs.
    expect(directives["worker-src"]).toContain("blob:");
    // The cross-origin housing API base URL stays reachable.
    expect(directives["connect-src"]).toContain("http://localhost:3000");
    // Objects and frames are fully denied.
    expect(directives["object-src"]).toEqual(["none"]);
    expect(directives["frame-ancestors"]).toEqual(["self"]);
  });

  test("dev mode additionally blesses inline scripts and the dev websocket", () => {
    const prod = securityCspDirectives({
      apiUrl: "http://localhost:3000",
      allowInlineScripts: false,
    });
    expect(prod["script-src"]).not.toContain("unsafe-inline");

    const dev = securityCspDirectives({
      apiUrl: "http://localhost:3000",
      allowInlineScripts: true,
    });
    expect(dev["script-src"]).toContain("unsafe-inline");
    expect(dev["connect-src"]).toContain("ws://localhost:5173");
  });

  test("keeps a custom API host reachable in production", () => {
    const directives = securityCspDirectives({
      apiUrl: "https://housing-api.example.gov",
      allowInlineScripts: false,
    });
    expect(directives["connect-src"]).toContain("https://housing-api.example.gov");
    expect(directives["connect-src"]).not.toContain("ws://localhost:5173");
  });
});
