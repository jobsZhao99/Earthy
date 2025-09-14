// src/utils/dates.ts
export function monthStartUTC(y: number, m01: number) {
    return new Date(Date.UTC(y, m01 - 1, 1));
  }
  export function nextMonthUTC(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
  

  export function toDateOnly(d: Date | string): Date {
    const iso = new Date(d).toISOString().slice(0, 10);
    return new Date(iso); // => 00:00:00 UTC
  }
  
  export function toDateStr(d: Date | null) {
    return d ? d.toISOString().slice(0, 10) : null;
  }