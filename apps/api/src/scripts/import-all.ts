import 'dotenv/config';
import { PrismaClient, Channel, BookingRecordType, BookingStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';

const prisma = new PrismaClient();
const TARGET_LEDGER_NAME = 'USC-TPM';

// -------- 工具函数 -------- //
function parseMoneyToCents(m: string | number | null | undefined): number | null {
  if (m == null) return null;
  if (typeof m === 'number') return Math.round(m * 100);
  const s = m.replace(/\$/g, '').replace(/,/g, '').trim();
  if (!s) return null;
  const f = Number(s);
  if (Number.isNaN(f)) return null;
  return Math.round(f * 100);
}

/**
 * 根据 note / confirmationCode 判断 channelId
 * @param note 备注信息
 * @param confirmationCode 订单号或合同号
 * @returns channelId (string)
 */
export async function detectChannel(
    note?: string | null,
    confirmationCode?: string | null
  ): Promise<string> {
    const s1 = (note || '').toLowerCase();
    const s2 = (confirmationCode || '').toLowerCase();
  
    let label = 'Airbnb'; // 默认值
  
    if (s1.includes('booking') || s2.includes('booking')) {
      label = 'Booking.com';
    } else if (s1.includes('leasing contract') || s2.includes('leasing contract')) {
      label = 'Leasing Contract';
    } else if (s1.includes('vrbo') || s2.includes('vrbo')) {
      label = 'Vrbo';
    }
  
    const channel = await prisma.channel.findUnique({
      where: { label },
      select: { id: true },
    });
  
    if (!channel) throw new Error(`❌ 未找到 Channel: ${label}，请先执行 seedChannels.ts`);
  
    return channel.id;
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

type Row = {
    property: string;
    unit: string;
    room: string;
    name: string;
    moveIn: string;
    moveOut: string;
    confirmedDate?: string;
    confirmationCode?: string;
    netRate?: string;
    totalRent?: string;
    note?: string;
};

// -------- TSV/CSV 解析 -------- //
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
  const nrIdx = idx('net rate');
  const trIdx = idx('total rent');
  const noteIdx = idx('note');

  for (const [label, v] of Object.entries({ pIdx, rIdx, nIdx, miIdx, moIdx,noteIdx })) {
    if (v === -1) throw new Error('缺少必需列：Property, Room, Name, Move in, Move out, Note');
  }

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
  console.log(`共 ${rows.length} 行，开始导入…`);

  const bar = new cliProgress.SingleBar(
    { format: '导入 |{bar}| {percentage}% | {value}/{total} OK:{ok} SKIP:{skip} FAIL:{fail}' },
    cliProgress.Presets.shades_classic
  );
  let ok = 0, skip = 0, fail = 0;
  bar.start(rows.length, 0, { ok, skip, fail });

  for (const r of rows) {
    try {
      const base = r.property.trim();
      const unitNorm = normalizeUnit(r.unit);
      const propertyName = unitNorm ? `${base}, Unit ${unitNorm}` : base;

      // upsert Property
      const property = await prisma.property.upsert({
        where: { ledgerId_name: { ledgerId, name: propertyName } },
        update: {},
        create: { ledgerId, name: propertyName, address: base }
      });

      // upsert Room
      const room = await prisma.room.upsert({
        where: { propertyId_label: { propertyId: property.id, label: r.room.trim() } },
        update: {},
        create: { propertyId: property.id, label: r.room.trim() }
      });

      // upsert Guest
      let guest = await prisma.guest.findFirst({ where: { name: r.name.trim() } });
      if (!guest) {
        guest = await prisma.guest.create({ data: { name: r.name.trim() } });
      }

      // create BookingRecord
// 替换你导入里的 create 部分
// 先创建 Booking
        const channelId = await detectChannel(r.note, r.confirmationCode);

        // 先查是否已存在相同 externalRef 的 Booking
        let booking = await prisma.booking.findFirst({
            where: { externalRef: r.confirmationCode || undefined, channelId, roomId: room.id }
        });
        
        if (!booking) {
            // —— 第一次出现 → 新建 Booking
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
            }
            });
        
            // 新建 BookingRecord (NEW)
            await prisma.bookingRecord.create({
            data: {
                bookingId: booking.id,
                type: BookingRecordType.NEW,
                guestDeltaCents: parseMoneyToCents(r.totalRent) ?? null,
                payoutDeltaCents: parseMoneyToCents(r.netRate) ?? null,
                rangeStart: parseDate(r.moveIn),
                rangeEnd: parseDate(r.moveOut),
                createdAt: parseDate(r.confirmedDate) || new Date(),
                memo: `Imported NEW from sheet, extRef=${r.confirmationCode || ''}`
            }
            });
        } else {
            // —— 已存在 Booking → 只追加 BookingRecord
            const guestDelta = parseMoneyToCents(r.totalRent) ?? 0;
            const payoutDelta = parseMoneyToCents(r.netRate) ?? 0;
        
            let type: BookingRecordType = BookingRecordType.EXTEND;
            if (guestDelta < 0 && payoutDelta < 0) {
            type = BookingRecordType.CANCEL;
            }
        
            await prisma.bookingRecord.create({
            data: {
                bookingId: booking.id,
                type,
                guestDeltaCents: guestDelta,
                payoutDeltaCents: payoutDelta,
                rangeStart: parseDate(r.moveIn),
                rangeEnd: parseDate(r.moveOut),
                createdAt: parseDate(r.confirmedDate) || new Date(),
                memo: `Imported ${type} from sheet, extRef=${r.confirmationCode || ''}`
            }
            });
        }
      ok++;
    } catch (e) {
      fail++;
      // console.error(e);
    } finally {
      bar.increment({ ok, skip, fail });
    }
  }

  bar.stop();
  console.log(`✅ 完成: ${ok} 成功, ${skip} 跳过, ${fail} 失败`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
