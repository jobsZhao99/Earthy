// src/utils/dates.ts
export function monthStartUTC(y: number, m01: number) {
    return new Date(Date.UTC(y, m01 - 1, 1));
  }
  export function nextMonthUTC(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
  