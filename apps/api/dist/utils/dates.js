// src/utils/dates.ts
export function monthStartUTC(y, m01) {
    return new Date(Date.UTC(y, m01 - 1, 1));
}
export function nextMonthUTC(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
