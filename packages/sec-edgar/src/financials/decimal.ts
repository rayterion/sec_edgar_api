import { EdgarError } from "../errors.js";
function parts(value: string): { coefficient: bigint; scale: number } {
  if (!/^-?\d+(?:\.\d+)?$/.test(value))
    throw new EdgarError("SCHEMA", "SEC fact is not a finite decimal");
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  return {
    coefficient: BigInt((negative ? "-" : "") + whole + fraction),
    scale: fraction.length,
  };
}
export function subtractDecimal(left: string, right: string): string {
  const a = parts(left),
    b = parts(right),
    scale = Math.max(a.scale, b.scale);
  const result =
    a.coefficient * 10n ** BigInt(scale - a.scale) -
    b.coefficient * 10n ** BigInt(scale - b.scale);
  const negative = result < 0n ? "-" : "";
  const digits = (result < 0n ? -result : result)
    .toString()
    .padStart(scale + 1, "0");
  if (!scale) return negative + digits;
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return negative + digits.slice(0, -scale) + (fraction ? "." + fraction : "");
}
export function safeNumber(exact: string): number | null {
  if (/^-?\d+$/.test(exact)) {
    const number = Number(exact);
    return Number.isSafeInteger(number) ? number : null;
  }
  const number = Number(exact);
  return Number.isFinite(number) && String(number) === exact ? number : null;
}
