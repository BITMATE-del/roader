import { ensureSchema, client } from "./_db.mjs";

export default async function handler(req,res){
  try{
    await ensureSchema();
    const sql = client();

    if(req.method==="GET"){
      const rows = await sql(`
        select s.id,s.scheduled_at,s.timezone,s.status,s.last_error,s.attempt_count,
          p.id as post_id,p.post_type,p.body,p.quality_score,p.quality_status,
          a.id as account_id,a.name as account_name,a.handle,
          coalesce(cp.auto_publish_threshold,90) as auto_publish_threshold
        from roader_schedules s
        join roader_posts p on p.id=s.post_id
        join roader_accounts a on a.id=p.account_id
        left join roader_content_profiles cp on cp.account_id=a.id
        order by s.scheduled_at desc
        limit 200
      `);
      return res.status(200).json({ok:true,schedules:rows});
    }

    if(req.method==="POST"){
      const b=req.body||{};
      if(!b.post_id||!b.scheduled_at) return res.status(400).json({ok:false,error:"post_id_and_scheduled_at_required"});
      const rows=await sql(
        "insert into roader_schedules (post_id,scheduled_at,timezone,status) values ($1,$2,$3,$4) returning *",
        [Number(b.post_id),String(b.scheduled_at),String(b.timezone||"Asia/Seoul"),String(b.status||"scheduled")]
      );
      return res.status(201).json({ok:true,schedule:rows[0]});
    }

    return res.status(405).json({ok:false,error:"method_not_allowed"});
  }catch(error){
    console.error("schedules-api",error);
    return res.status(500).json({ok:false,error:"server_error"});
  }
}
