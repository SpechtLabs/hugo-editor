import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  newImagePaths,
  repoPathToYamlImage,
  slugify,
  yamlImageToRepoPath,
} from "../src/lib/portfolio/paths";
import { collectCategories, isPermutation } from "../src/lib/portfolio/transform";
import {
  addItem,
  readItems,
  removeItemAt,
  reorderItems,
  updateItemAt,
} from "../src/lib/portfolio/yaml";

const fixture = readFileSync(new URL("./fixtures/portfolio.sample.yml", import.meta.url), "utf8");
const prefixes = { imageDir: "static/images", imagePublicPrefix: "/images" };

describe("readItems", () => {
  test("parses every entry in document order", () => {
    const items = readItems(fixture);
    expect(items.map((i) => i.name)).toEqual([
      "Rankenring",
      "Mondstein Kette mit Iolith",
      "Jugendstil Haarkamm",
      "Goldplattierte Ohrstecker",
      "Rauchquarz Ohrhänger",
    ]);
  });

  test("preserves all fields including rotate and multi-category", () => {
    const items = readItems(fixture);
    expect(items[1].categories).toEqual(["Ohrschmuck", "Halsschmuck"]);
    expect(items[2].rotate).toBe(90);
    expect(items[0].rotate).toBeUndefined();
    expect(items[3].link).toBe("/blog/ohrstecker-goldplattiert");
    expect(items[4].link).toBe("#");
  });
});

describe("reorderItems", () => {
  test("reverses order while keeping fields intact", () => {
    const out = readItems(reorderItems(fixture, [4, 3, 2, 1, 0]));
    expect(out.map((i) => i.name)).toEqual([
      "Rauchquarz Ohrhänger",
      "Goldplattierte Ohrstecker",
      "Jugendstil Haarkamm",
      "Mondstein Kette mit Iolith",
      "Rankenring",
    ]);
    expect(out.find((i) => i.name === "Jugendstil Haarkamm")?.rotate).toBe(90);
  });

  test("identity permutation is byte-stable", () => {
    expect(reorderItems(fixture, [0, 1, 2, 3, 4])).toBe(fixture);
  });

  test("never drops an entry even when two share an image", () => {
    // duplicate the first entry's image onto the second, then reorder fully
    const dup = updateItemAt(fixture, 1, { image: "/images/rankenring.jpg.webp" });
    const out = readItems(reorderItems(dup, [4, 3, 2, 1, 0]));
    expect(out).toHaveLength(5);
  });

  test("rejects a non-permutation (missing index)", () => {
    expect(() => reorderItems(fixture, [0, 1, 2, 3])).toThrow();
    expect(() => reorderItems(fixture, [0, 1, 2, 3, 3])).toThrow();
  });
});

describe("addItem", () => {
  test("inserts at the top by default", () => {
    const out = readItems(
      addItem(fixture, {
        name: "Neuer Anhänger",
        image: "/images/neuer-anhaenger.webp",
        categories: ["Halsschmuck"],
        content: "750/- Roségold",
        link: "",
      }),
    );
    expect(out).toHaveLength(6);
    expect(out[0].name).toBe("Neuer Anhänger");
    expect(out[0].image).toBe("/images/neuer-anhaenger.webp");
  });

  test("can append at the end", () => {
    const out = readItems(
      addItem(
        fixture,
        {
          name: "Letztes Stück",
          image: "/images/letztes.webp",
          categories: [],
          content: "",
          link: "",
        },
        { position: "end" },
      ),
    );
    expect(out[out.length - 1].name).toBe("Letztes Stück");
  });
});

describe("updateItemAt", () => {
  test("patches editable fields without touching siblings", () => {
    const out = readItems(
      updateItemAt(fixture, 0, {
        name: "Rankenring (Platin)",
        content: "950/- Platin",
        categories: ["Ring", "Sonderanfertigung"],
        link: "/blog/rankenring",
      }),
    );
    expect(out[0].name).toBe("Rankenring (Platin)");
    expect(out[0].content).toBe("950/- Platin");
    expect(out[0].categories).toEqual(["Ring", "Sonderanfertigung"]);
    expect(out[0].link).toBe("/blog/rankenring");
    expect(out[2].rotate).toBe(90); // unrelated entry untouched
  });

  test("rotate can be added and removed", () => {
    const added = updateItemAt(fixture, 0, { rotate: 270 });
    expect(readItems(added)[0].rotate).toBe(270);
    const removed = updateItemAt(added, 0, { rotate: null });
    expect(readItems(removed)[0].rotate).toBeUndefined();
  });

  test("expectImage guard catches a stale index", () => {
    expect(() =>
      updateItemAt(fixture, 0, { name: "x" }, { expectImage: "/images/wrong.webp" }),
    ).toThrow(/stale edit/);
    // correct guard passes
    expect(() =>
      updateItemAt(fixture, 0, { name: "x" }, { expectImage: "/images/rankenring.jpg.webp" }),
    ).not.toThrow();
  });

  test("throws for an out-of-range index", () => {
    expect(() => updateItemAt(fixture, 99, { name: "x" })).toThrow(/out of range/);
  });
});

describe("removeItemAt", () => {
  test("removes the entry at the given index", () => {
    const out = readItems(removeItemAt(fixture, 2));
    expect(out).toHaveLength(4);
    expect(out.some((i) => i.name === "Jugendstil Haarkamm")).toBe(false);
  });

  test("guard prevents deleting the wrong entry", () => {
    expect(() => removeItemAt(fixture, 2, { expectImage: "/images/rankenring.jpg.webp" })).toThrow(
      /stale edit/,
    );
  });
});

describe("paths", () => {
  test("maps YAML image values to repo paths (absolute and relative)", () => {
    expect(yamlImageToRepoPath("/images/ring.webp", prefixes)).toBe("static/images/ring.webp");
    expect(yamlImageToRepoPath("images/galerie/x.webp", prefixes)).toBe(
      "static/images/galerie/x.webp",
    );
  });

  test("repo path back to YAML image is the inverse", () => {
    expect(repoPathToYamlImage("static/images/galerie/x.webp", prefixes)).toBe(
      "/images/galerie/x.webp",
    );
  });

  test("slugify handles German umlauts and punctuation", () => {
    expect(slugify("Jugendstil Haarkamm mit Saphir & Tüll")).toBe(
      "jugendstil-haarkamm-mit-saphir-tuell",
    );
    expect(slugify("   ")).toBe("image");
  });

  test("newImagePaths builds a consistent filename/repo/yaml triple", () => {
    expect(newImagePaths("Rankenring", "abc12345", prefixes)).toEqual({
      filename: "rankenring-abc12345.webp",
      repoPath: "static/images/rankenring-abc12345.webp",
      yamlImage: "/images/rankenring-abc12345.webp",
    });
  });
});

describe("transform", () => {
  test("collectCategories returns sorted distinct categories", () => {
    expect(collectCategories(readItems(fixture))).toEqual([
      "Halsschmuck",
      "Ohrschmuck",
      "Ring",
      "Sonstiges",
    ]);
  });

  test("isPermutation validates reorder payloads", () => {
    expect(isPermutation([2, 0, 1], 3)).toBe(true);
    expect(isPermutation([0, 1], 3)).toBe(false);
    expect(isPermutation([0, 1, 1], 3)).toBe(false);
  });
});
