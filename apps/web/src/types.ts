export type ID = string;

export interface Ledger {
  id: ID;
  name: string;
}

export interface Property {
  id: ID;
  name: string;
  address?: string | null;
  ledgerId: ID;
}

export interface Room {
  id: ID;
  propertyId: ID;
  label: string;
  nightlyRateCents?: number | null;
  property?: Property;
}

export interface Guest {
  id: ID;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface Channel {
  id: ID;
  label: string; // e.g. "Airbnb", "Booking.com"
}

export type BookingStatus =
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED";

export interface Booking {
  id: ID;
  roomId: ID;
  guestId: ID;
  channelId: ID;
  externalRef?: string | null; // confirmation code / contract
  checkIn: string; // ISO date string
  checkOut: string; // ISO date string
  guestTotalCents?: number | null;
  payoutCents?: number | null;
  status: BookingStatus;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;

  // relations
  room?: Room;
  guest?: Guest;
  channel?: Channel;
  bookingRecords?: BookingRecord[];
}

export type BookingRecordType =
  | "NEW"
  | "UPDATE"
  | "CANCEL"
  | "EXTEND"
  | "SHORTEN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN";

export interface BookingRecord {
  id: ID;
  bookingId: ID;
  type: BookingRecordType;
  guestDeltaCents?: number | null;
  payoutDeltaCents?: number | null;
  rangeStart?: string | null; // ISO date string
  rangeEnd?: string | null;
  createdAt: string;
  memo?: string | null;

  booking?: Booking;
}

export interface Paged<T> {
  page: number;
  pageSize: number;
  total: number;
  rows: T[];
}
