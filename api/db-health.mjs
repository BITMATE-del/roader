import { ensureSchema, dbHealth } from "./_db.mjs";

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === "GET") {
      const health = await dbHealth();
      return res.status(200).json({ ok: true, database: health.database, now: health.now });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    console.error("db-health", error);
    return res.status(500).json({ ok: false, error: "database_error" });
  }
}
