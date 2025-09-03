// apps/api/src/routes/bookings.js
import { PrismaClient, Channel } from "@prisma/client";
import { z } from "zod";
import { postBookingAccruals } from "../../services/posting.js";

const prisma = new PrismaClient();

// 入参校验（支持两种写法：用已有ID；或用 propertyId + roomLabel / guestName 自动找或创建）
const payloadSchema = z.object({
  // 方式A：已知ID
  roomId: z.string().cuid().optional(),
  guestId: z.string().cuid().optional(),

  // 方式B：通过标识创建/查找
  propertyId: z.string().cuid().optional(),
  roomLabel: z.string().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  guestEmail: z.string().email().optional(),

  checkIn: z.string().or(z.date()),
  checkOut: z.string().or(z.date()),

  // 金额（建议前端传字符串，避免小数精度问题）
  guestTotal: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  payout: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),

  channel: z.nativeEnum(Channel).default("AIRBNB")
})
.superRefine((val, ctx) => {
  if (!val.roomId && !(val.propertyId && val.roomLabel)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "roomId 或 (propertyId+roomLabel) 必须提供其一" });
  }
  if (!val.guestId && !val.guestName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "guestId 或 guestName 必须提供其一" });
  }
});

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export async function createBookingHandler(req, res) {
  try {
    const payload = payloadSchema.parse(req.body);

    const checkIn = toDate(payload.checkIn);
    const checkOut = toDate(payload.checkOut);
    if (!(checkOut > checkIn)) {
      return res.status(400).json({ error: "checkOut 必须晚于 checkIn（退房日不计夜）" });
    }

    // 1) 准备 Room
    let roomId = payload.roomId;
    if (!roomId) {
      // 通过 propertyId + roomLabel 查找或报错（也可选择自动创建）
      const room = await prisma.room.findFirst({
        where: { propertyId: payload.propertyId, label: payload.roomLabel }
      });
      if (!room) return res.status(400).json({ error: "找不到对应的房间（propertyId + roomLabel）" });
      roomId = room.id;
    }

    // 2) 准备 Guest
    let guestId = payload.guestId;
    if (!guestId) {
      // 先尝试按姓名+邮箱匹配，匹配不到就创建
      const existing = payload.guestEmail
        ? await prisma.guest.findFirst({ where: { email: payload.guestEmail } })
        : null;

      const guest = existing || await prisma.guest.create({
        data: {
          name: payload.guestName || "Guest",
          phone: payload.guestPhone || null,
          email: payload.guestEmail || null
        }
      });
      guestId = guest.id;
    }

    // 3) 创建 Booking（Decimal 字段 guestTotal/payout 建议传字符串给 Prisma）
    const created = await prisma.booking.create({
      data: {
        roomId,
        guestId,
        checkIn,
        checkOut,
        channel: payload.channel,
        guestTotal: payload.guestTotal ?? null, // 字符串或 null
        payout: payload.payout ?? null,         // 字符串或 null
        // 初次快照物业时区（可选：也可留给 posting 时补）
        tzSnapshot: await (async () => {
          const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: { property: true }
          });
          return room?.property?.timezone || "America/Los_Angeles";
        })()
      },
      include: {
        room: { include: { property: true } },
        guest: true
      }
    });

    // 4) 触发入账分摊（幂等）
    await postBookingAccruals(created.id);

    return res.status(201).json(created);
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: err.issues?.map(i => i.message).join("; ") });
    }
    console.error(err);
    return res.status(500).json({ error: "创建失败", detail: String(err?.message || err) });
  }
}
