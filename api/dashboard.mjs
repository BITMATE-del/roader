import { ensureSchema, client } from "./_db.mjs";

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const sql = client();

    if (req.method !== "GET") return res.status(405).json({ ok:false, error:"method_not_allowed" });

    const [totals, accounts, schedules, posts, leads] = await Promise.all([
      sql(`
        with latest as (
          select distinct on (post_id)
            post_id,views,likes,replies,reposts,quotes,shares,profile_visits,bot_entries,applications
          from roader_metrics
          order by post_id,captured_at desc
        )
        select
          coalesce(sum(views),0)::bigint as views,
          coalesce(sum(likes),0)::bigint as likes,
          coalesce(sum(replies),0)::bigint as replies,
          coalesce(sum(reposts),0)::bigint as reposts,
          coalesce(sum(quotes),0)::bigint as quotes,
          coalesce(sum(shares),0)::bigint as shares,
          coalesce(sum(profile_visits),0)::bigint as profile_visits,
          coalesce(sum(bot_entries),0)::bigint as bot_entries,
          coalesce(sum(applications),0)::bigint as applications
        from latest
      `),
      sql(`
        select a.*,
          coalesce((select count(*) from roader_posts p where p.account_id=a.id and p.created_at::date = now()::date),0)::int as posted_today,
          coalesce((select max(m.views) from roader_posts p join roader_metrics m on m.post_id=p.id where p.account_id=a.id),0)::bigint as latest_views
        from roader_accounts a
        order by a.created_at asc
      `),
      sql(`
        select s.id,s.scheduled_at,s.status,p.post_type,p.body,p.quality_score,a.name as account_name
        from roader_schedules s
        join roader_posts p on p.id=s.post_id
        join roader_accounts a on a.id=p.account_id
        where (s.scheduled_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
        order by s.scheduled_at asc
      `),
      sql(`
        select p.id,p.body,p.post_type,p.status,p.quality_score,p.created_at,a.name as account_name,
          coalesce((select views from roader_metrics m where m.post_id=p.id order by captured_at desc limit 1),0)::bigint as views,
          coalesce((select likes from roader_metrics m where m.post_id=p.id order by captured_at desc limit 1),0)::bigint as likes,
          coalesce((select replies from roader_metrics m where m.post_id=p.id order by captured_at desc limit 1),0)::bigint as replies,
          coalesce((select reposts from roader_metrics m where m.post_id=p.id order by captured_at desc limit 1),0)::bigint as reposts,
          coalesce((select quotes from roader_metrics m where m.post_id=p.id order by captured_at desc limit 1),0)::bigint as quotes,
          coalesce((select shares from roader_metrics m where m.post_id=p.id order by captured_at desc limit 1),0)::bigint as shares,
          coalesce((select profile_visits from roader_metrics m where m.post_id=p.id order by captured_at desc limit 1),0)::bigint as profile_visits,
          coalesce((select bot_entries from roader_metrics m where m.post_id=p.id order by captured_at desc limit 1),0)::bigint as bot_entries
        from roader_posts p
        join roader_accounts a on a.id=p.account_id
        order by p.created_at desc
        limit 10
      `),
      sql(`
        select count(*)::int as total,
          count(*) filter (where status='pending')::int as pending,
          count(*) filter (where status='approved')::int as approved,
          count(*) filter (where status='rejected')::int as rejected
        from roader_leads
      `)
    ]);

    return res.status(200).json({
      ok:true,
      totals: totals[0],
      accounts,
      schedules,
      posts,
      leads: leads[0]
    });
  } catch (error) {
    console.error("dashboard-api", error);
    return res.status(500).json({ ok:false, error:"server_error" });
  }
}
