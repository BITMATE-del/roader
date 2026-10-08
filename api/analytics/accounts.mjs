import { ensureSchema, client } from "../_db.mjs";
export default async function handler(req,res){
  try{
    if(req.method!=="GET") return res.status(405).json({ok:false,error:"method_not_allowed"});
    await ensureSchema();
    const sql=client();
    const rows=await sql(`
      with latest as (
        select distinct on(m.post_id) m.post_id,m.views,m.likes,m.replies,m.reposts,m.quotes,m.shares,m.captured_at
        from roader_metrics m order by m.post_id,m.captured_at desc
      ), aggregated as (
        select a.id as account_id,a.name as account_name,a.handle,a.daily_post_goal,
          count(p.id) filter(where p.status='published')::int as published_count,
          count(p.id) filter(where p.status='published' and p.published_at>=now()-interval '7 days')::int as posted_7d,
          coalesce(sum(l.views) filter(where p.status='published'),0)::bigint as views,
          coalesce(sum(l.likes) filter(where p.status='published'),0)::bigint as likes,
          coalesce(sum(l.replies) filter(where p.status='published'),0)::bigint as replies,
          coalesce(sum(l.reposts) filter(where p.status='published'),0)::bigint as reposts,
          coalesce(sum(l.quotes) filter(where p.status='published'),0)::bigint as quotes,
          coalesce(sum(l.shares) filter(where p.status='published'),0)::bigint as shares,
          count(l.post_id) filter(where p.status='published')::int as measured_count,
          max(l.captured_at) as last_measured_at,
          coalesce(avg(p.quality_score) filter(where p.status='published'),0)::numeric(8,2) as avg_quality
        from roader_accounts a
        left join roader_posts p on p.account_id=a.id
        left join latest l on l.post_id=p.id
        group by a.id,a.name,a.handle,a.daily_post_goal
      )
      select g.*,coalesce(pp.confidence,0)::int as learning_confidence,
        coalesce(pp.sample_count,0)::int as learning_samples
      from aggregated g
      left join roader_performance_profiles pp on pp.account_id=g.account_id
      order by g.views desc,g.account_name
    `);
    return res.status(200).json({ok:true,accounts:rows});
  }catch(error){
    console.error("account-analytics",error);
    return res.status(500).json({ok:false,error:"account_analytics_failed",details:String(error.message||"")});
  }
}