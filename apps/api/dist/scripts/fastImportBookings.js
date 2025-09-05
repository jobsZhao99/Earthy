import 'dotenv/config';
import { Channel, BookingRecordStatus } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import cliProgress from 'cli-progress';
import pLimit from 'p-limit';
import { prisma } from '../prisma.js';
import { postBookingAccruals } from '../services/posting.js';
const CITY_SUFFIX = ', Los Angeles, CA, USA';
const TARGET_LEDGER_NAME = 'USC-TPM';
const LA_TZ = 'America/Los_Angeles';
function stripCitySuffix(full) {
    const s = (full || '').trim();
    if (!s)
        return s;
    if (s.endsWith(CITY_SUFFIX))
        return s.slice(0, -CITY_SUFFIX.length).trim();
    const alt = 'Los Angeles, CA, USA';
    const idx = s.lastIndexOf(alt);
    if (idx >= 0 && idx + alt.length === s.length) {
        return s.slice(0, idx).replace(/,\s*$/, '').trim();
    }
    return s;
}
function normalizeUnit(u) {
    if (!u)
        return '';
    let s = u.toString().trim();
    if (!s)
        return '';
    if (/\bwhole\b/i.test(s))
        return '';
    s = s.replace(/[,]/g, ' ').replace(/\b(unit|rm|room)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    return s.toUpperCase();
}
function parseMoneyToCents(m) {
    if (m == null)
        return null;
    if (typeof m === 'number')
        return Math.round(m * 100);
    const s = m.replace(/\$/g, '').replace(/,/g, '').trim();
    if (!s)
        return null;
    const f = Number(s);
    if (Number.isNaN(f))
        return null;
    return Math.round(f * 100);
}
function parseLADateWithTime(dateStr, hour, minute) {
    const dt = DateTime.fromISO(dateStr.trim(), { zone: LA_TZ }).set({ hour, minute, second: 0, millisecond: 0 });
    if (!dt.isValid)
        throw new Error(`Invalid date: ${dateStr}`);
    return dt.toJSDate();
}
function detectChannel(confirmation) {
    const s = (confirmation || '').toLowerCase();
    if (s.includes('leasing contract'))
        return Channel.LEASING_CONTRACT;
    return Channel.AIRBNB;
}
function parseTable(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length)
        return [];
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
    const idx = (name) => header.findIndex(h => h === name.toLowerCase());
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
    for (const [label, v] of Object.entries({ pIdx, rIdx, nIdx, miIdx, moIdx })) {
        if (v === -1)
            throw new Error('缺少必需列：Property, Room, Name, Move in, Move out');
    }
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep);
        const get = (i) => (i >= 0 ? (cols[i] ?? '').trim() : '');
        const row = {
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
        if (!row.property || !row.room || !row.name || !row.moveIn || !row.moveOut)
            continue;
        rows.push(row);
    }
    return rows;
}
async function getLedgerId() {
    let ledger = await prisma.ledger.findFirst({
        where: { name: TARGET_LEDGER_NAME },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
    });
    if (!ledger) {
        ledger = await prisma.ledger.create({ data: { name: TARGET_LEDGER_NAME }, select: { id: true } });
    }
    return ledger.id;
}
async function main() {
    const fileArg = process.argv[2] || 'data/bookings.tsv';
    const filePath = path.resolve(process.cwd(), fileArg);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 找不到文件：${filePath}`);
        process.exit(1);
    }
    console.log('没有可导入的行。');
    const rows = parseTable(filePath);
    if (!rows.length) {
        console.log('没有可导入的行。');
        // return;
    }
    {
        console.log('行数：', rows.length);
    }
    const bar = new cliProgress.SingleBar({ format: '导入进度 |{bar}| {percentage}% | {value}/{total} | 成功:{ok} 跳过:{skip} 失败:{fail}' }, cliProgress.Presets.shades_classic);
    let ok = 0, skip = 0, fail = 0;
    bar.start(rows.length, 0, { ok, skip, fail });
    const ledgerId = await getLedgerId();
    // ---------- 预加载：Property & Room 映射 ----------
    // 需要的 propertyName 集合
    const wantedPropertyNames = new Set();
    const wantedRoomPairs = [];
    for (const r of rows) {
        const base = stripCitySuffix(r.property);
        const unitNorm = normalizeUnit(r.unit);
        const propertyName = unitNorm ? `${base}, Unit ${unitNorm}` : base;
        wantedPropertyNames.add(propertyName);
        wantedRoomPairs.push({ propertyName, label: r.room.trim() });
    }
    // 查出所有涉及的 properties
    const properties = await prisma.property.findMany({
        where: { ledgerId, name: { in: Array.from(wantedPropertyNames) } },
        select: { id: true, name: true }
    });
    const nameToPropertyId = new Map(properties.map(p => [p.name, p.id]));
    // 查出这些 property 下的所有 rooms（一次性）
    const propIds = properties.map(p => p.id);
    const rooms = await prisma.room.findMany({
        where: { propertyId: { in: propIds } },
        select: { id: true, propertyId: true, label: true }
    });
    const roomKeyToId = new Map(); // key = `${propertyId}::${label}`
    for (const r of rooms)
        roomKeyToId.set(`${r.propertyId}::${r.label}`, r.id);
    // ---------- 预加载：Guest 映射（先查已有，再批量创建缺的） ----------
    const wantedGuestNames = Array.from(new Set(rows.map(r => r.name.trim())));
    const existingGuests = await prisma.guest.findMany({
        where: { name: { in: wantedGuestNames } },
        select: { id: true, name: true }
    });
    const nameToGuestId = new Map(existingGuests.map(g => [g.name, g.id]));
    const missingNames = wantedGuestNames.filter(n => !nameToGuestId.has(n));
    if (missingNames.length) {
        // 批量创建
        await prisma.guest.createMany({
            data: missingNames.map(n => ({ name: n })),
            skipDuplicates: true
        });
        // 再查一次把 id 补齐
        const newly = await prisma.guest.findMany({
            where: { name: { in: missingNames } },
            select: { id: true, name: true }
        });
        newly.forEach(g => nameToGuestId.set(g.name, g.id));
    }
    // --- 逐条并发创建 booking（受控并发），并收集 bookingIds 供后续过账 ---
    const limit = pLimit(8); // 并发度 8，可视数据库性能调整
    const newBookingIds = [];
    const notFound = [];
    await Promise.allSettled(rows.map(r => limit(async () => {
        try {
            const base = stripCitySuffix(r.property);
            const unitNorm = normalizeUnit(r.unit);
            const propertyName = unitNorm ? `${base}, Unit ${unitNorm}` : base;
            const propertyId = nameToPropertyId.get(propertyName);
            if (!propertyId) {
                skip++;
                notFound.push(`Property "${propertyName}"`);
                bar.increment({ ok, skip, fail });
                return;
            }
            const label = r.room.trim();
            const roomId = roomKeyToId.get(`${propertyId}::${label}`);
            if (!roomId) {
                skip++;
                notFound.push(`Room "${propertyName}" / "${label}"`);
                bar.increment({ ok, skip, fail });
                return;
            }
            const guestId = nameToGuestId.get(r.name.trim());
            if (!guestId) {
                skip++;
                notFound.push(`Guest "${r.name}"`);
                bar.increment({ ok, skip, fail });
                return;
            }
            const checkIn = parseLADateWithTime(r.moveIn, 15, 0);
            const checkOut = parseLADateWithTime(r.moveOut, 11, 0);
            const payoutCents = parseMoneyToCents(r.netRate) ?? null;
            const guestTotalCents = parseMoneyToCents(r.totalRent) ?? null;
            const channel = detectChannel(r.confirmationCode);
            const memoParts = [];
            if (r.note)
                memoParts.push(r.note);
            if (r.confirmedDate)
                memoParts.push(`Confirmed: ${r.confirmedDate}`);
            const memo = memoParts.join(' | ') || null;
            const created = await prisma.bookingRecord.create({
                data: {
                    roomId, guestId, checkIn, checkOut, channel,
                    guestTotalCents, payoutCents,
                    confirmationCode: r.confirmationCode || null,
                    contractUrl: null, status: BookingRecordStatus.NEW, memo
                },
                select: { id: true }
            });
            newBookingIds.push(created.id);
            ok++;
        }
        catch (e) {
            fail++;
            // 不在循环中输出堆栈，避免 I/O 拖慢；必要时记录到文件
            // console.error(e);
        }
        finally {
            bar.increment({ ok, skip, fail });
        }
    })));
    bar.stop();
    // --- 统一过账（并发受控） ---
    if (newBookingIds.length) {
        const bar2 = new cliProgress.SingleBar({ format: '过账进度 |{bar}| {percentage}% | {value}/{total}' }, cliProgress.Presets.shades_classic);
        bar2.start(newBookingIds.length, 0);
        const postLimit = pLimit(6); // 过账稍小的并发以降低事务竞争
        await Promise.allSettled(newBookingIds.map(id => postLimit(async () => {
            await postBookingAccruals(id);
            bar2.increment();
        })));
        bar2.stop();
    }
    // 统一输出未命中项（避免中途大量 console）
    if (notFound.length) {
        const top = Array.from(new Set(notFound)).slice(0, 30);
        console.warn(`⚠️ 未找到的关联（去重后展示前 30 条）：\n- ${top.join('\n- ')}\n共 ${new Set(notFound).size} 种未命中类型。`);
    }
    console.log(`✅ 完成。
  原始行数: ${rows.length}
  成功写入: ${ok}
  跳过(未匹配 property/room/guest): ${skip}
  失败: ${fail}
  已过账: ${newBookingIds.length}`);
}
main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
