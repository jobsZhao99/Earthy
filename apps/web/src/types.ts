export type ID = string;

export interface Ledger { id: ID; name: string; }
export interface Property {
  id: ID; name: string; address?: string | null; ledgerId: ID; timezone: string;
}
export interface Room {
  id: ID; propertyId: ID; label: string; nightlyRateCents?: number | null;
  property?: Property;
}
export interface Guest { id: ID; name: string; email?: string | null; phone?: string | null; }
export type Channel = 'AIRBNB'|'BOOKING_COM'|'EXPEDIA'|'DIRECT'|'LEASING_CONTRACT'|'OTHER';
export type BookingRecordStatus = 'NEW'|'TRANSFER'|'CANCELL';



export interface BookingRecord {
  id: string;
  checkIn: string;
  checkOut: string;
  payoutCents?: number;
  channel?: string;
  guest?: {
    id: string;
    name: string;
    confirmationCode?: string;
  };
  room?: {
    id: string;
    label: string;
    property?: {
      id: string;
      name: string;
    };
  };
}

export interface Paged<T> { page: number; pageSize: number; total: number; rows: T[]; }
