// apps/api/src/index.js
import express from "express";
import cors from "cors";
import { createBookingHandler } from "./routes/bookings.js";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*", credentials: true }));
app.use(express.json());

app.post("/api/bookings", createBookingHandler);
app.get("/healthz", (req,res)=>res.json({ok:true}));

app.listen(process.env.PORT || 3000, () => {
  console.log("API listening");
});
