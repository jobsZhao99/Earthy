// src/routes/cleaning.ts
import { Router } from "express";
import { prisma } from "../prisma";

const r = Router();

/**
 * GET /api/cleaning/checkout?from=2025-08-01&to=2025-09-30&propertyId=...
 * 生成退房清洁窗口：windowStart=checkOut；windowEnd=下一次 checkIn 或 +24h
 */
r.get("/checkout", async (req, res) => {
  const { from, to, propertyId } = req.query as any;
  if (!from || !to) return res.status(400).json({ error: "from/to required (ISO date)" });

  const rows = await prisma.$queryRaw<any[]>`
    WITH base AS (
      SELECT
        b."id" AS booking_id,
        p."name" AS property,
        p."id"   AS property_id,
        r."label" AS room,
        b."roomId",
        b."checkIn",
        b."checkOut"
      FROM "BookingRecord" b
      JOIN "Room" r ON r."id" = b."roomId"
      JOIN "Property" p ON p."id" = r."propertyId"
      WHERE b."checkOut" >= ${new Date(from)}
        AND b."checkOut" <  ${new Date(to)}
        ${propertyId ? prisma.$unsafe(`AND p."id" = '${propertyId}'`) : prisma.$unsafe("")}
    )
    SELECT
      booking_id,
      property,
      property_id,
      room,
      checkOut AS "windowStart",
      COALESCE(
        (
          SELECT MIN(b2."checkIn")
          FROM "BookingRecord" b2
          WHERE b2."roomId" = base."roomId"
            AND b2."checkIn" > base."checkOut"
        ),
        base."checkOut" + interval '24 hours'
      ) AS "windowEnd"
    FROM base
    ORDER BY property, room, "windowStart";
  `;

  res.json({ rows });
});

export default r;
