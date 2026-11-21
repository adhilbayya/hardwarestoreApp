/**
 * Date utilities for synchronizing local browser dates with SQLite UTC timestamps.
 */

/**
 * Converts a user-selected local date (e.g. "YYYY-MM-DD") to a UTC SQLite timestamp string
 * ("YYYY-MM-DD HH:MM:SS") so that SQLite's `date(..., 'localtime')` precisely reconstructs
 * the user's chosen local calendar date without drifting into adjacent days.
 */
export function formatLocalDateToDbUtc(dateInput?: string | null): string | null {
  if (!dateInput) return null;
  const trimmed = dateInput.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const now = new Date();
    const timeStr = [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join(":");
    const localDate = new Date(`${trimmed}T${timeStr}`);
    if (!isNaN(localDate.getTime())) {
      return localDate.toISOString().replace("T", " ").substring(0, 19);
    }
    return `${trimmed} 12:00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed)) {
    const localDate = new Date(trimmed.replace(" ", "T"));
    if (!isNaN(localDate.getTime())) {
      return localDate.toISOString().replace("T", " ").substring(0, 19);
    }
  }
  return trimmed;
}

/**
 * Converts a SQLite stored UTC timestamp string (e.g. "2026-11-01 20:30:00")
 * to the user's local date in "YYYY-MM-DD" format for HTML date inputs.
 */
export function formatDbUtcToLocalDate(utcInput?: string | null): string {
  if (!utcInput) return "";
  const trimmed = utcInput.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const isoStr = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T") + (trimmed.endsWith("Z") ? "" : "Z");
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) {
    return trimmed.split(" ")[0];
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
