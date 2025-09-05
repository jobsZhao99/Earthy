import { Router } from "express";
import { prisma } from "../prisma.js";
import { getPagination } from "../utils/pagination.js";
import { postBookingAccruals } from "../services/posting.js";
const r = Router();
/** 列表：支持 一堆过滤 + 分页 */
r.get("/", async (req, res) => {
    const { propertyId, roomId, guestId, channel, status, from, to, q } = req.query;
    const { skip, take, page, pageSize } = getPagination(req.query);
    const where = {};
    if (roomId)
        where.roomId = String(roomId);
    if (guestId)
        where.guestId = String(guestId);
    if (channel)
        where.channel = String(channel);
    if (status)
        where.status = String(status);
    if (propertyId)
        where.room = { propertyId: String(propertyId) };
    if (from || to) {
        where.AND = [
            { checkOut: { gte: from ? new Date(String(from)) : undefined } },
            { checkIn: { lt: to ? new Date(String(to)) : undefined } },
        ];
    }
    if (q) {
        where.OR = [
            { confirmationCode: { contains: String(q), mode: "insensitive" } },
            { guest: { name: { contains: String(q), mode: "insensitive" } } },
        ];
    }
    const [rows, total] = await Promise.all([
        prisma.bookingRecord.findMany({
            where, skip, take,
            orderBy: { checkIn: "desc" },
            include: { room: { include: { property: true } }, guest: true },
        }),
        prisma.bookingRecord.count({ where }),
    ]);
    res.json({ page, pageSize, total, rows });
});
/** 详情 */
r.get("/:id", async (req, res) => {
    const row = await prisma.bookingRecord.findUnique({
        where: { id: req.params.id },
        include: { room: { include: { property: true } }, guest: true, journalLines: true },
    });
    if (!row)
        return res.status(404).json({ error: "Not found" });
    res.json(row);
});
/** 新建 */
r.post("/", async (req, res) => {
    const { roomId, guestId, checkIn, checkOut, channel, guestTotalCents, payoutCents, confirmationCode, contractUrl, status } = req.body;
    if (!roomId || !guestId || !checkIn || !checkOut)
        return res.status(400).json({ error: "roomId/guestId/checkIn/checkOut required" });
    const created = await prisma.bookingRecord.create({
        data: {
            roomId, guestId,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            channel, guestTotalCents, payoutCents, confirmationCode, contractUrl, status,
        },
    });
    // —— 关键：创建后立即自动过账（同步执行）——
    const posting = await postBookingAccruals(created.id);
    res.status(201).json({ booking: created, posting });
});
/** 批量创建（导入用） */
r.post("/bulk", async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [];
    if (!items.length)
        return res.status(400).json({ error: "array body required" });
    const data = items.map((x) => ({
        roomId: x.roomId,
        guestId: x.guestId,
        checkIn: new Date(x.checkIn),
        checkOut: new Date(x.checkOut),
        channel: x.channel,
        guestTotalCents: x.guestTotalCents,
        payoutCents: x.payoutCents,
        confirmationCode: x.confirmationCode,
        contractUrl: x.contractUrl,
        status: x.status,
        memo: x.memo,
    }));
    const created = await prisma.bookingRecord.createMany({ data, skipDuplicates: true });
    res.status(201).json(created);
});
/** 更新 */
r.patch("/:id", async (req, res) => {
    const data = { ...req.body };
    if (data.checkIn)
        data.checkIn = new Date(data.checkIn);
    if (data.checkOut)
        data.checkOut = new Date(data.checkOut);
    const updated = await prisma.bookingRecord.update({ where: { id: req.params.id }, data });
    res.json(updated);
});
/** 删除 */
r.delete("/:id", async (req, res) => {
    await prisma.bookingRecord.delete({ where: { id: req.params.id } });
    res.status(204).end();
});
/** 批量删除（根据过滤条件危险操作，务必加确认） */
r.delete("/", async (req, res) => {
    const { propertyId, before } = req.query;
    const where = {};
    if (propertyId)
        where.room = { propertyId: String(propertyId) };
    if (before)
        where.checkIn = { lt: new Date(String(before)) };
    const out = await prisma.bookingRecord.deleteMany({ where });
    res.json(out);
});
export default r;
