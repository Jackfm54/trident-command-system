import { describe, expect, it } from "vitest";
import { LANGUAGES, parseLanguage, setLanguage } from "./i18n";

describe("language selection", () => {
  it("supports Spanish, English and French", () => {
    expect(LANGUAGES).toEqual(["es", "en", "fr"]);
    for (const value of LANGUAGES) expect(parseLanguage(value)).toBe(value);
  });
  it("defaults unsupported or missing preferences to Spanish", () => {
    expect(parseLanguage("de")).toBe("es");
    expect(parseLanguage(null)).toBe("es");
  });
  it.each(LANGUAGES)("persists %s locally and sets the document language", (value) => {
    setLanguage(value);
    expect(localStorage.getItem("tcm.language")).toBe(value);
    expect(document.documentElement.lang).toBe(value);
  });
});