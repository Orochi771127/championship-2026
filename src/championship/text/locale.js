// The display language, and the number / date / plural rules that go with it.
//
// UI locales: zh-Hant (default source) and en. The ja preference selects
// Japanese battle text only; other UI remains in its zh-Hant source. The language is a PRODUCT_AUTHORED presentation choice:
// it never changes a data id, an enum, a save field or a player-typed name.
// Switching it notifies subscribers so long-lived chrome can relabel itself;
// screens mounted afterwards simply render in the new language.

export const DEFAULT_LOCALE = "zh-Hant";
export const LOCALES = Object.freeze(["zh-Hant", "en", "ja", "th", "vi"]);

let current = DEFAULT_LOCALE;
const listeners = new Set();

export function getLocale() {
  return current;
}

export function isEnglish() {
  return current === "en";
}

/** Returns true when the locale changed. An unknown locale is refused. */
export function setLocale(locale) {
  if (!LOCALES.includes(locale) || locale === current) return false;
  current = locale;
  for (const listener of [...listeners]) {
    try { listener(current); } catch { /* one observer must not stop the others */ }
  }
  return true;
}

export function onLocaleChange(listener) {
  if (typeof listener !== "function") throw new TypeError("A locale observer must be a function");
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- Formatting ---------------------------------------------------------------

const formatters = new Map();
function cached(kind, locale, options, make) {
  const key = `${kind}|${locale}|${JSON.stringify(options ?? {})}`;
  if (!formatters.has(key)) {
    try { formatters.set(key, make()); } catch { formatters.set(key, null); }
  }
  return formatters.get(key);
}

/** 1234 -> "1,234" in all locales; a non-number passes through unchanged. */
export function formatNumber(value, options) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  const format = cached("number", current, options, () => new Intl.NumberFormat(current, options));
  return format ? format.format(value) : String(value);
}

/** A real-world moment (a save time), in the reader's calendar and clock. Gregorian calendar is preserved. */
export function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const options = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  const localeTag = current === "en" ? "en-GB" : current === "ja" ? "ja-JP" : current === "th" ? "th-TH-u-ca-gregory" : current === "vi" ? "vi-VN" : "zh-Hant-TW";
  const format = cached("datetime", current, options, () => new Intl.DateTimeFormat(localeTag, { ...options, calendar: "gregory" }));
  return format ? format.format(date) : date.toISOString();
}

/** The CLDR plural category of `count` in the current locale ("one", "other", ...). */
export function pluralCategory(count) {
  if (typeof count !== "number" || !Number.isFinite(count)) return "other";
  const rules = cached("plural", current, null, () => new Intl.PluralRules(current));
  return rules ? rules.select(count) : (count === 1 ? "one" : "other");
}

/** Join a list the way the language does: 「A、B、C」 or "A, B and C". */
export function formatList(items) {
  const list = (items ?? []).filter((item) => item !== null && item !== undefined && item !== "").map(String);
  if (current === "zh-Hant" || current === "ja") return list.join("、");
  const localeTag = current === "th" ? "th" : current === "vi" ? "vi" : "en";
  const format = cached("list", current, null, () => new Intl.ListFormat(localeTag, { style: "long", type: "conjunction" }));
  return format ? format.format(list) : list.join(", ");
}
