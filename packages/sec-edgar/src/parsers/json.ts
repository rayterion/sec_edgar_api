import { EdgarError } from "../errors.js";

// Quote unsafe numeric tokens before JSON.parse can round them.
export function parseLosslessJson(body: string, url?: string): unknown {
  let encoded = "";
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < body.length;) {
    const char = body[i]!;
    if (quoted) {
      encoded += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      i++;
      continue;
    }
    if (char === '"') {
      quoted = true;
      encoded += char;
      i++;
      continue;
    }
    if (char === "-" || (char >= "0" && char <= "9")) {
      const match = body
        .slice(i)
        .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (match) {
        const value = match[0];
        encoded +=
          Number.isSafeInteger(Number(value)) && !/[.eE]/.test(value)
            ? value
            : JSON.stringify(value);
        i += value.length;
        continue;
      }
    }
    encoded += char;
    i++;
  }
  try {
    return JSON.parse(encoded) as unknown;
  } catch (cause) {
    throw new EdgarError("MALFORMED_JSON", "SEC returned malformed JSON", {
      url,
      cause,
    });
  }
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const time = Date.parse(value + "T00:00:00Z");
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
