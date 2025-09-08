// apps/api/src/index.js
import express from "express";
import cors from "cors";
// import { createBookingHandler } from "./routes/bookingsbackup.js";
import guests from "./routes/guests.js";            // ✅ 加这行导入


const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*", credentials: true }));
app.use(express.json());

app.post("/api/bookings", createBookingHandler);
app.get("/healthz", (req,res)=>res.json({ok:true}));
app.use("/api/guests", guests);                     // ✅ 注册 guests 路由

app.listen(process.env.PORT || 3000, () => {
  console.log("API listening");
});
