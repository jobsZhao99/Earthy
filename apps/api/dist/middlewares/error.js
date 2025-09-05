export function errorHandler(err, _req, res, _next) {
    // Prisma 唯一键冲突
    if (err?.code === "P2002") {
        return res.status(409).json({ error: "Unique constraint violation", meta: err.meta });
    }
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
}
