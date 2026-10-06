import { ensureSchema, client } from "./_db.mjs";

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = client();

    if (req.method === "GET") {
      const rows = await sql(
        "select p.*,a.name as account_name,a.handle from roader_posts p join roader_accounts a on a.id=p.account_id order by p.created_at desc limit 100"
      );
      return res.status(200).json({ ok: true, posts: rows });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      if (!body.account_id || !String(body.body || "").trim()) {
        return res.status(400).json({ ok: false, error: "account_id_and_body_required" });
      }

      const rows = await sql(
        "insert into roader_posts (account_id,topic_id,post_type,media_mode,body,quality_score,quality_status,quality_details,status,source_code) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) returning *",
        [
          Number(body.account_id),
          body.topic_id ? Number(body.topic_id) : null,
          String(body.post_type || "정보형"),
          String(body.media_mode || "text"),
          String(body.body),
          body.quality_score ?? null,
          body.quality_status ?? null,
          JSON.stringify(body.quality_details || {}),
          String(body.status || "draft"),
          String(body.source_code || "")
        ]
      );
      return res.status(201).json({ ok: true, post: rows[0] });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    console.error("posts-api", error);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
