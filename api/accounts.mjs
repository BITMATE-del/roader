import { ensureSchema, client } from "./_db.mjs";

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = client();

    if (req.method === "GET") {
      const rows = await sql(
        "select a.*, coalesce(cp.min_chars,180) as min_chars, coalesce(cp.max_chars,420) as max_chars, coalesce(cp.quality_threshold,80) as quality_threshold, coalesce(cp.auto_publish_threshold,90) as auto_publish_threshold, coalesce(cp.type_mix,'{}'::jsonb) as type_mix, coalesce(sp.profile,'{}'::jsonb) as learned_style, coalesce(sp.confidence,0) as style_confidence, coalesce(sp.sample_count,0) as style_sample_count, coalesce(pp.strategy,'{}'::jsonb) as performance_strategy, coalesce(pp.confidence,0) as performance_confidence, coalesce(pp.sample_count,0) as performance_sample_count, pp.last_learned_at from roader_accounts a left join roader_content_profiles cp on cp.account_id=a.id left join roader_style_profiles sp on sp.account_id=a.id left join roader_performance_profiles pp on pp.account_id=a.id order by a.created_at asc"
      );
      return res.status(200).json({ ok: true, accounts: rows });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const name = String(body.name || "").trim();
      const handle = String(body.handle || "").trim();
      if (!name || !handle) return res.status(400).json({ ok: false, error: "name_and_handle_required" });

      const rows = await sql(
        "insert into roader_accounts (name,handle,sector,target_audience,tone,persona,daily_post_goal,cta_ratio,telegram_source_code) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",
        [name, handle, String(body.sector || ""), String(body.target_audience || ""), String(body.tone || ""), String(body.persona || ""), Number(body.daily_post_goal || 0), Number(body.cta_ratio || 0), String(body.telegram_source_code || "")]
      );
      let account = rows[0];

      if (!account.telegram_source_code) {
        const handleSlug = handle
          .replace(/^@+/, "")
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "_")
          .replace(/^_+|_+$/g, "") || "threads";
        const sourceCode = (`threads_${handleSlug}_${account.id}`).slice(0,64);
        const updated = await sql(
          "update roader_accounts set telegram_source_code=$1, updated_at=now() where id=$2 returning *",
          [sourceCode, account.id]
        );
        account = updated[0];
      }

      await sql(
        "insert into roader_content_profiles (account_id) values ($1) on conflict (account_id) do nothing",
        [account.id]
      );

      return res.status(201).json({ ok: true, account });
    }

    if (req.method === "DELETE") {
      const body = req.body || {};
      const id = Number(body.id || req.query?.id);
      if (!id) return res.status(400).json({ ok: false, error: "id_required" });

      const current = await sql(
        "select id,name,handle,telegram_source_code from roader_accounts where id=$1",
        [id]
      );
      if (!current[0]) return res.status(404).json({ ok: false, error: "not_found" });

      const account = current[0];
      await sql("delete from roader_accounts where id=$1", [id]);

      return res.status(200).json({
        ok: true,
        deleted: {
          id: account.id,
          name: account.name,
          handle: account.handle
        }
      });
    }

    if (req.method === "PATCH") {
      const body = req.body || {};
      const id = Number(body.id);
      if (!id) return res.status(400).json({ ok: false, error: "id_required" });

      const current = await sql("select * from roader_accounts where id=$1", [id]);
      if (!current[0]) return res.status(404).json({ ok: false, error: "not_found" });
      const a = current[0];

      const rows = await sql(
        "update roader_accounts set name=$1, sector=$2, target_audience=$3, tone=$4, persona=$5, daily_post_goal=$6, cta_ratio=$7, is_active=$8, updated_at=now() where id=$9 returning *",
        [
          body.name ?? a.name,
          body.sector ?? a.sector,
          body.target_audience ?? a.target_audience,
          body.tone ?? a.tone,
          body.persona ?? a.persona,
          body.daily_post_goal ?? a.daily_post_goal,
          body.cta_ratio ?? a.cta_ratio,
          body.is_active ?? a.is_active,
          id
        ]
      );
      return res.status(200).json({ ok: true, account: rows[0] });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    console.error("accounts-api", error);
    const msg = String(error?.message || "");
    return res.status(msg.includes("duplicate") ? 409 : 500).json({ ok: false, error: msg.includes("duplicate") ? "handle_exists" : "server_error" });
  }
}
