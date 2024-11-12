import { DateTime, DateTimeOptions } from "luxon";
import { AttributeValue } from "./models";

export function formatDate(
  date: Date | null | DateTime,
  format: string = "yyyy-MM-dd",
) {
  if (!date) {
    return "";
  }
  if (date instanceof Date) {
    return formatDate(DateTime.fromJSDate(date));
  }
  return date.toFormat(format);
}

export function parseDate(
  date: string,
  format: string = "yyyy-MM-dd",
  opts: DateTimeOptions = { zone: "utc" },
): DateTime {
  const dt = DateTime.fromFormat(date, format, opts);
  if (dt.isValid) {
    return dt;
  }
  return DateTime.fromISO(date);
}

export function readString(value: string) {
  if (/^\s*["]/.test(value) && /["]\s*$/.test(value)) {
    return value
      .replace(/^\s*["]/, "")
      .replace(/["]\s*$/, "")
      .replaceAll('\\"', '"');
  } else if (/^\s*[']/.test(value) && /[']\s*$/.test(value)) {
    return value
      .replace(/^\s*[']/, "")
      .replace(/[']\s*$/, "")
      .replaceAll("\\'", "'");
  }
  return value;
}

export function writeString(value: string) {
  return '"' + value.replaceAll(/["]/g, '\\"') + '"';
}

export function isAccount(value: string) {
  return /^[A-Z][a-z]+:([A-Z0-9][A-Za-z0-9-]*:)*[A-Z0-9][A-Za-z0-9-]*$/.test(
    value,
  );
}

export function isCurrency(value: string) {
  return /^[A-Z][A-Z0-9'_-]*[A-Z0-9]$/.test(value);
}

export function writeAttribute(
  value: AttributeValue | ArrayLike<AttributeValue>,
): string {
  if (value == null || value === undefined) {
    return "";
  } else if (Array.isArray(value)) {
    return value.map((it) => writeAttribute(it)).join(" ");
  } else if (typeof value === "string") {
    if (isCurrency(value) || isAccount(value)) {
      return value;
    }
    return writeString(value);
  } else if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (value instanceof DateTime || value instanceof Date) {
    return formatDate(value);
  }

  return value.toString();
}
