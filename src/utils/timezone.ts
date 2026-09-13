/**
 * Timezone Utility for Asia/Kolkata (IST = UTC + 05:30)
 * Handles conversion between Admin UI inputs (date & 12-hr/24-hr time in IST)
 * and absolute UTC ISO strings stored in MongoDB / Server.
 */

/**
 * Parses local date string (YYYY-MM-DD or MM/DD/YYYY) and local time string (12-hr AM/PM or 24-hr)
 * in the specified timezone (default 'Asia/Kolkata').
 * Returns a JS Date object representing the absolute UTC instant, or null if invalid.
 *
 * Examples:
 * - "2026-09-11", "10:00 AM" -> 2026-09-11T04:30:00.000Z
 * - "2026-09-11", "12:00 AM" -> 2026-09-10T18:30:00.000Z
 * - "2026-09-11", "12:00 PM" -> 2026-09-11T06:30:00.000Z
 * - "2026-09-11", "11:42 AM" -> 2026-09-11T06:12:00.000Z
 * - "2026-09-11", "11:47 AM" -> 2026-09-11T06:17:00.000Z
 */
export function parseLocalDateTime(
  dateStr: string,
  timeStr: string,
  timezone: string = 'Asia/Kolkata',
  treatMidnightAsNextDay: boolean = false
): Date | null {
  if (!dateStr || !timeStr) return null;

  const trimmedDate = dateStr.trim();
  const trimmedTime = timeStr.trim();

  let year = 0, month = 0, day = 0;
  if (trimmedDate.includes('-')) {
    const parts = trimmedDate.split('-');
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else if (parts[2].length === 4) {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      }
    }
  } else if (trimmedDate.includes('/')) {
    const parts = trimmedDate.split('/');
    if (parts.length >= 3) {
      if (parts[2].length === 4) {
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      }
    }
  }

  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Regex matching "10:00", "10:00 AM", "12:00 PM", "11:42:00 AM", "1:00pm", etc.
  const timeRegex = /^\s*(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*\d{1,2})?\s*(AM|PM|am|pm)?\s*$/i;
  const match = trimmedTime.match(timeRegex);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) return null;

  const isMidnight = (ampm === 'AM' && hours === 12) || (!ampm && hours === 0 && minutes === 0);

  if (ampm) {
    if (hours < 1 || hours > 12) return null;
    if (ampm === 'AM') {
      if (hours === 12) hours = 0;
    } else if (ampm === 'PM') {
      if (hours < 12) hours += 12;
    }
  } else {
    if (hours < 0 || hours > 23) return null;
  }

  // Asia/Kolkata is IST = UTC + 05:30.
  // UTC = IST - 5h 30m
  let tzOffsetHours = 5;
  let tzOffsetMinutes = 30;

  if (timezone.includes('UTC') || timezone.includes('GMT')) {
    tzOffsetHours = 0;
    tzOffsetMinutes = 0;
  }

  let targetDay = day;
  if (isMidnight && treatMidnightAsNextDay) {
    targetDay += 1;
  }

  const utcMs = Date.UTC(year, month - 1, targetDay, hours - tzOffsetHours, minutes - tzOffsetMinutes, 0, 0);
  const result = new Date(utcMs);
  if (isNaN(result.getTime())) return null;

  return result;
}

/**
 * Converts date (YYYY-MM-DD) and time (HH:MM 12-hr/24-hr) in Asia/Kolkata (IST)
 * to an absolute UTC ISO string.
 */
export function convertToUTCISOString(dateStr: string, timeStr: string, timezone: string = 'Asia/Kolkata'): string {
  const d = parseLocalDateTime(dateStr, timeStr, timezone);
  if (!d) return new Date().toISOString();
  return d.toISOString();
}

/**
 * Formats an absolute UTC ISO string into date (YYYY-MM-DD) and time (HH:MM 24-hour)
 * in the Asia/Kolkata timezone.
 */
export function formatInAsiaKolkata(isoString: string | undefined | null): { startDate: string; startTime: string } {
  if (!isoString) {
    const now = new Date();
    return formatInAsiaKolkata(now.toISOString());
  }

  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return formatInAsiaKolkata(now.toISOString());
  }

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const startDate = dateFormatter.format(d); // YYYY-MM-DD

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const startTime = timeFormatter.format(d); // HH:MM (24-hour)

  return { startDate, startTime };
}

/**
 * Formats an ISO string into human-readable IST string (e.g. "11 Sep 2026, 11:15 AM IST").
 */
export function formatReadableIST(isoString: string | undefined | null): string {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'N/A';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d) + ' IST';
}
