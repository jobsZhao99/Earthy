// src/routes/reports.ts
import { Router } from "express";
import { prisma } from "../prisma.js";
import { monthStartUTC } from "../utils/dates.js";
import { AccountCode } from "@prisma/client";
const r = Router();
/** GET /api/reports/monthly?from=YYYY-MM&to=YYYY-MM&propertyId=... */
r.get("/monthly", async (req, res) => {
    const { from, to, propertyId } = req.query;
    if (!from || !to)
        return res.status(400).json({ error: "from/to required (YYYY-MM)" });
    const [fy, fm] = String(from).split("-").map(Number);
    const [ty, tm] = String(to).split("-").map(Number);
    const fromUTC = monthStartUTC(fy, fm);
    const toUTC = monthStartUTC(ty, tm);
    const rows = await prisma.$queryRawUnsafe(`
    SELECT
      date_trunc('month', j."periodMonth")::date AS month,
      p."name" AS property,
      r."label" AS room,
      SUM(CASE WHEN jl."account" = '${AccountCode.RENT}'     THEN jl."amountCents" ELSE 0 END) AS rent_cents,
      SUM(CASE WHEN jl."account" = '${AccountCode.PARKING}'  THEN jl."amountCents" ELSE 0 END) AS parking_cents,
      SUM(CASE WHEN jl."account" = '${AccountCode.BEDDING}'  THEN jl."amountCents" ELSE 0 END) AS bedding_cents,
      SUM(CASE WHEN jl."account" = '${AccountCode.CLEANING}' THEN jl."amountCents" ELSE 0 END) AS cleaning_cents,
      SUM(CASE WHEN jl."account" = '${AccountCode.OTHERS}'   THEN jl."amountCents" ELSE 0 END) AS others_cents,
      SUM(jl."amountCents") AS net_cents
    FROM "JournalEntry" j
    JOIN "JournalLine" jl ON jl."journalId" = j."id"
    JOIN "BookingRecord" b ON b."id" = jl."bookingId"
    JOIN "Room" r ON r."id" = b."roomId"
    JOIN "Property" p ON p."id" = r."propertyId"
    WHERE j."periodMonth" >= $1
      AND j."periodMonth" <= $2
      ${propertyId ? `AND p."id" = '${propertyId}'` : ""}
    GROUP BY 1,2,3
    ORDER BY 1,2,3
  `, fromUTC, toUTC);
    res.json({ rows });
});
export default r;
