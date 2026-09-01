import { describe, expect, it } from "vitest";
import { materialListLabel } from "../lib/materialDraft";
import { nextVersionedMaterialFilename, parseMaterialFilename, versionForNew } from "./materials";

describe("parseMaterialFilename", () => {
  it.each([
    ["сталь_v2.json", { family: "сталь", version: 2 }],
    ["сталь.json", { family: "сталь", version: 1 }],
    ["нержавеющая-сталь_v10.json", { family: "нержавеющая-сталь", version: 10 }]
  ] as const)("parses %s", (filename, expected) => {
    expect(parseMaterialFilename(filename)).toEqual(expected);
  });
});

describe("nextVersionedMaterialFilename", () => {
    it.each([
      ["сталь.json", ["сталь.json"], "сталь_v2.json"],
      ["сталь.json", ["сталь.json", "сталь_v2.json", "сталь_v10.json"], "сталь_v11.json"],
      ["сталь.json", ["сталь.json", "сталь_v2.json", "сталь_v10.json", "аллюминий.json"], "сталь_v11.json"],
      ["нержавеющая-сталь_v5.json", [], "нержавеющая-сталь_v6.json"]
    ] as const)("parses %s", (filename,existingFilenames, expected) => {
      expect(nextVersionedMaterialFilename(filename, existingFilenames)).toEqual(expected);
    });
  });

  describe("versionForNew", () => {
    it.each([
        ["сталь.json", "сталь_v1.json"],
        ["сталь_v1.json", "сталь_v1.json"]
    ] as const)("parses %s", (filename, expected) => {
        expect(versionForNew(filename)).toEqual(expected);
    });
  });

describe("materialListLabel", () => {
  it.each([
    ["08Х13_v2.json", "08Х13"],
    ["сталь.json", "сталь"],
  ] as const)("%s → %s without metadata name", (filename, expected) => {
    expect(materialListLabel({ filename, name: "" })).toEqual(expected);
  });

  it("prefers metadata display name over filename", () => {
    expect(
      materialListLabel({
        filename: "08Х13_v2.json",
        name: "08Х13 (0Х13, ЭИ 496)",
      }),
    ).toEqual("08Х13 (0Х13, ЭИ 496)");
  });
});