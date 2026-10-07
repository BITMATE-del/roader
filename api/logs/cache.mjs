import { ensureSchema, client } from "../_db.mjs";

export default async function handler(req,res){
  try{
    if(req.method!=="GET") return res.status(405).json({ok:false,error:"method_not_allowed"});
    await ensureSchema();
    const sql=client();
    const limit=Math.max(20,Math.min(300,Number(req.query?.limit||120)));
    const rows=await sql(
      `select r.id,r.run_date,r.slot_index,r.slot_hour,r.status,r.post_id,r.quality_score,
        r.attempt_count,r.last_error,r.created_at,r.updated_at,
        a.id as account_id,a.name as account_name,a.handle,
        p.generated_topic,p.body,p.threads_post_id,p.published_at
       from roader_automation_runs r
       join roader_accounts a on a.id=r.account_id
       left join roader_posts p on p.id=r.post_id
       order by r.updated_at desc
       limit $1`,
      [limit]
    );
    return res.status(200).json({ok:true,logs:rows});
  }catch(error){
    console.error("cache-logs",error);
    return res.status(500).json({ok:false,error:"server_error",details:String(error?.message||"")});
  }
}
