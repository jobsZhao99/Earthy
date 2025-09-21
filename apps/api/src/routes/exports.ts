import { Router } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../prisma.js";

const r = Router();

r.get("/", async (req, res) => {
  try {
    const bookingRecords = await prisma.bookingRecord.findMany({
      include: {
        booking: {
          include: {
            room: { include: { property: true } },
            guest: true,
          },
        },
        journalLines: { include: { journal: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    console.log("导出条数:", bookingRecords.length);

    const monthsSet = new Set<string>();
    for (const br of bookingRecords) {
      for (const jl of br.journalLines) {
        monthsSet.add(jl.journal.periodMonth.toISOString().slice(0, 7));
      }
    }
    const months = Array.from(monthsSet).sort();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("BookingRecords");

    ws.addRow([
      "ExternalRef",
      "Property",
      "Room",
      "Guest",
      "RecordType",
      "StartDate",
      "EndDate",
      "PayoutDelta",
      "GuestDelta",
      "RecordCreatedAt",
      ...months,
    ]);

    for (const br of bookingRecords) {
      const b = br.booking;
      const row: (string | number)[] = [
        b.externalRef ?? "",
        b.room?.property?.name ?? "",
        b.room?.label ?? "",
        b.guest?.name ?? "",
        br.type,
        br.rangeStart ? br.rangeStart.toISOString().slice(0, 10) : "",
        br.rangeEnd ? br.rangeEnd.toISOString().slice(0, 10) : "",
        br.payoutDeltaCents ? br.payoutDeltaCents / 100 : 0,
        br.guestDeltaCents ? br.guestDeltaCents / 100 : 0,
        br.createdAt.toISOString().slice(0, 10),
      ];

      const monthMap: Record<string, number> = {};
      for (const jl of br.journalLines) {
        const m = jl.journal.periodMonth.toISOString().slice(0, 7);
        monthMap[m] = (monthMap[m] ?? 0) + jl.amountCents / 100;
      }

      for (const m of months) {
        row.push(monthMap[m] ?? 0);
      }

      ws.addRow(row);
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=booking-records.xlsx"
    );

    await wb.xlsx.write(res); // 自动 end
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

export default r;
