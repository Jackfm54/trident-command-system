import { useSyncExternalStore } from "react";
import { translations } from "./translations";

export const LANGUAGES = ["es", "en", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];
const STORAGE_KEY = "tcm.language";
export function parseLanguage(value: string | null): Language {
  return value === "en" || value === "fr" ? value : "es";
}
function readLanguage(): Language {
  try {
    return parseLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "es";
  }
}
let language = readLanguage();
const listeners = new Set<() => void>();
export function setLanguage(value: Language) {
  language = parseLanguage(value);
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* Storage may be unavailable. */
  }
  document.documentElement.lang = language;
  listeners.forEach((notify) => notify());
}
if (typeof window !== "undefined") {
  document.documentElement.lang = language;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    language = parseLanguage(event.newValue);
    document.documentElement.lang = language;
    listeners.forEach((notify) => notify());
  });
}
function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}
export function useLanguage() {
  const selected = useSyncExternalStore(
    subscribe,
    () => language,
    () => "es" as Language,
  );
  return { language: selected, setLanguage };
}
export function locale() {
  return language === "fr" ? "fr-FR" : language === "en" ? "en-GB" : "es-CO";
}
export function t(source: string, ...values: unknown[]): string {
  const template =
    language === "es" ? source : (translations[source]?.[language] ?? source);
  return template.replace(/\{(\d+)\}/g, (match, index: string) =>
    values[Number(index)] === undefined ? match : String(values[Number(index)]),
  );
}

// Localize known system-generated records without rewriting shared exercise data.
const patterns = Object.keys(translations)
  .filter((key) => /\{\d+\}/.test(key))
  .map((key) => {
    const parts = key.split(/\{\d+\}/);
    const escaped = parts.map((part) =>
      part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    return { key, regex: new RegExp("^" + escaped.join("(.*?)") + "$", "s") };
  });
export function translateText(source: string): string {
  if (language === "es") return source;
  if (translations[source]) return t(source);
  for (const { key, regex } of patterns) {
    const match = source.match(regex);
    if (match) return t(key, ...match.slice(1));
  }
  return source;
}

/** Translate standalone print documents too; never alter scripts, names or styles. */
export function localizePrintHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.documentElement.lang = language;
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (!node.parentElement?.closest("script, style")) {
      const original = node.textContent ?? "";
      node.textContent = original
        .split(" · ")
        .map((part) => {
          const trimmed = part.trim();
          let translated = translateText(trimmed);
          for (const label of ["Ejercicio:", "Buques:", "Impreso:"]) {
            if (trimmed.startsWith(label))
              translated = t(label) + trimmed.slice(label.length);
          }
          translated = translated.replace(
            /(\d+) eventos$/,
            "$1 " + t("eventos"),
          );
          return part.replace(trimmed, translated);
        })
        .join(" · ");
    }
    node = walker.nextNode();
  }
  return "<!doctype html>" + doc.documentElement.outerHTML;
}
