import 'dotenv/config';
import { PrismaClient, BookingRecordType, BookingStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';

const prisma = new PrismaClient();
const TARGET_LEDGER_NAME = 'USC-TPM';

// -------- 工具函数 -------- //
function parseMoneyToCents(m?: string | number | null): number | null {
  if (m == null) return null;
  if (typeof m === 'number') return Math.round(m * 100);
  const s = m.replace(/\$/g, '').replace(/,/g, '').trim();
  if (!s) return null;
  const f = Number(s);
  if (Number.isNaN(f)) return null;
  return Math.round(f * 100);
}

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? null : d;
}

function normalizeUnit(u?: string | null): string {
  if (!u) return '';
  let s = u.trim();
  if (!s) return '';
  if (/whole/i.test(s)) return '';
  s = s.replace(/\b(unit|room|rm)\b/gi, '').trim();
  return s.toUpperCase();
}

// -------- 预加载 Channel -------- //
async function preloadChannels() {
  const channels = await prisma.channel.findMany({ select: { id: true, label: true } });
  const map = new Map<string, string>();
  for (const c of channels) {
    map.set(c.label.toLowerCase(), c.id);
  }
  return map;
}

function detectChannelSync(note?: string | null, confirmationCode?: string | null, channelMap?: Map<string, string>): string {
  const s1 = (note || '').toLowerCase();
  const s2 = (confirmationCode || '').toLowerCase();
  let label = 'airbnb';
  if (s1.includes('booking') || s2.includes('booking')) label = 'booking.com';
  else if (s1.includes('leasing contract') || s2.includes('leasing contract')) label = 'leasing contract';
  else if (s1.includes('vrbo') || s2.includes('vrbo')) label = 'vrbo';
  const id = channelMap?.get(label);
  if (!id) throw new Error(`❌ 未找到 Channel: ${label}`);
  return id;
}

// -------- TSV/CSV 解析 -------- //
type Row = {
  property: string;
  unit: string;
  room: string;
  name: string;
  moveIn: string;
  moveOut: string;
  confirmedDate?: string;
  confirmationCode?: string;
  type?: string;
  netRate?: string;
  totalRent?: string;
  note?: string;
};

function parseTable(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const idx = (name: string) => header.findIndex(h => h === name.toLowerCase());

  const pIdx = idx('property');
  const uIdx = idx('unit');
  const rIdx = idx('room');
  const nIdx = idx('name');
  const miIdx = idx('move in');
  const moIdx = idx('move out');
  const cdIdx = idx('confirmed date');
  const ccIdx = idx('confirmation code');
  const typeIdx = idx('type');
  const nrIdx = idx('net rate');
  const trIdx = idx('total rent');
  const noteIdx = idx('note');

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const get = (i: number) => (i >= 0 ? (cols[i] ?? '').trim() : '');
    const row: Row = {
      property: get(pIdx),
      unit: get(uIdx),
      room: get(rIdx),
      name: get(nIdx),
      moveIn: get(miIdx),
      moveOut: get(moIdx),
      confirmedDate: get(cdIdx),
      confirmationCode: get(ccIdx),
      netRate: get(nrIdx),
      totalRent: get(trIdx),
      note: get(noteIdx),
      type: get(typeIdx),
    };
    if (!row.property || !row.room || !row.name || !row.moveIn || !row.moveOut) continue;
    rows.push(row);
  }
  return rows;
}

// -------- 主逻辑 -------- //
async function getLedgerId(): Promise<string> {
  let ledger = await prisma.ledger.findFirst({
    where: { name: TARGET_LEDGER_NAME },
    select: { id: true }
  });
  if (!ledger) {
    ledger = await prisma.ledger.create({ data: { name: TARGET_LEDGER_NAME }, select: { id: true } });
  }
  return ledger.id;
}

// -------- Type 映射 -------- //
function mapType(t?: string): BookingRecordType {
  if (!t) return BookingRecordType.NEW;
  const s = t.trim().toUpperCase();
  if (s.includes('CANCEL')) return BookingRecordType.CANCEL;
  if (s.includes('EXTEND')) return BookingRecordType.EXTEND;
  if (s.includes('UPDATE')) return BookingRecordType.UPDATE;
  if (s.includes('SHORTEN')) return BookingRecordType.SHORTEN;
  if (s.includes('TRANSFER OUT')) return BookingRecordType.TRANSFER_OUT;
  if (s.includes('TRANSFER IN')) return BookingRecordType.TRANSFER_IN;
  return BookingRecordType.NEW;
}

async function main() {
  const fileArg = process.argv[2] || 'data/all.tsv';
  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 找不到文件：${filePath}`);
    process.exit(1);
  }

  const rows = parseTable(filePath);
  if (!rows.length) {
    console.log('没有可导入的行。');
    return;
  }

  const ledgerId = await getLedgerId();
  const channelMap = await preloadChannels();

  // 缓存
  const propertyCache = new Map<string, any>();
  const roomCache = new Map<string, any>();
  const guestCache = new Map<string, any>();

  console.log(`共 ${rows.length} 行，开始导入…`);
  const bar = new cliProgress.SingleBar(
    { format: '导入 |{bar}| {percentage}% | {value}/{total} OK:{ok} FAIL:{fail}' },
    cliProgress.Presets.shades_classic
  );
  let ok = 0, fail = 0;
  bar.start(rows.length, 0, { ok, fail });

  for (const r of rows) {
    try {
      const base = r.property.trim();
      const unitNorm = normalizeUnit(r.unit);
      const propertyName = unitNorm ? `${base}, Unit ${unitNorm}` : base;

      // Property
      let property = propertyCache.get(propertyName);
      if (!property) {
        property = await prisma.property.upsert({
          where: { ledgerId_name: { ledgerId, name: propertyName } },
          update: {},
          create: { ledgerId, name: propertyName, address: base }
        });
        propertyCache.set(propertyName, property);
      }

      // Room
      const roomKey = `${property.id}_${r.room.trim()}`;
      let room = roomCache.get(roomKey);
      if (!room) {
        room = await prisma.room.upsert({
          where: { propertyId_label: { propertyId: property.id, label: r.room.trim() } },
          update: {},
          create: { propertyId: property.id, label: r.room.trim() }
        });
        roomCache.set(roomKey, room);
      }

      // Guest (按名字合并)
      let guest = guestCache.get(r.name.trim());
      if (!guest) {
        guest = await prisma.guest.findFirst({ where: { name: r.name.trim() } });
        if (!guest) guest = await prisma.guest.create({ data: { name: r.name.trim() } });
        guestCache.set(r.name.trim(), guest);
      }

      // Booking
      const confirmDate = parseDate(r.confirmedDate) || new Date();

      const channelId = detectChannelSync(r.note, r.confirmationCode, channelMap);
      let booking = await prisma.booking.findFirst({
        where: { externalRef: r.confirmationCode || undefined, channelId, roomId: room.id }
      });

      if (!booking) {
        booking = await prisma.booking.create({
          data: {
            roomId: room.id,
            guestId: guest.id,
            checkIn: parseDate(r.moveIn)!,
            checkOut: parseDate(r.moveOut)!,
            externalRef: r.confirmationCode || null,
            guestTotalCents: parseMoneyToCents(r.totalRent),
            payoutCents: parseMoneyToCents(r.netRate),
            channelId,
            memo: r.note || null,
            status: BookingStatus.CONFIRMED,
            createdAt: confirmDate,   // 👈 用 ConfirmedDate
            updatedAt: confirmDate,   // 👈 同步覆盖
          }
        });

        await prisma.bookingRecord.create({
          data: {
            bookingId: booking.id,
            type: mapType(r.type),
            guestDeltaCents: parseMoneyToCents(r.totalRent),
            payoutDeltaCents: parseMoneyToCents(r.netRate),
            rangeStart: parseDate(r.moveIn),
            rangeEnd: parseDate(r.moveOut),
            // createdAt: parseDate(r.confirmedDate) || new Date(),
            createdAt: confirmDate,   // 👈 用 ConfirmedDate
            memo: `Imported NEW from sheet, extRef=${r.confirmationCode || ''}`
          }
        });
      } else {

        booking = await prisma.booking.update({
          where: { id: booking.id },
          data: { updatedAt: confirmDate }  // 👈 覆盖 updatedAt
        });
      
        await prisma.bookingRecord.create({
          data: {
            bookingId: booking.id,
            type: mapType(r.type),
            guestDeltaCents: parseMoneyToCents(r.totalRent) ?? 0,
            payoutDeltaCents: parseMoneyToCents(r.netRate) ?? 0,
            rangeStart: parseDate(r.moveIn),
            rangeEnd: parseDate(r.moveOut),
            createdAt: parseDate(r.confirmedDate) || new Date(),
            memo: `Imported EXTEND from sheet, extRef=${r.confirmationCode || ''}`
          }
        });
      }

      ok++;
    } catch (e: any) {
      fail++;
      console.error(`❌ 行导入失败: ${e.message}`);
    } finally {
      bar.increment({ ok, fail });
    }
  }

  bar.stop();
  console.log(`✅ 完成: ${ok} 成功, ${fail} 失败`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
