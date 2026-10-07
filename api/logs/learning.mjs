import { ensureSchema, client } from "../_db.mjs";

export default async function handler(req,res){
  try{
    if(req.method!=="GET") return res.status(405).json({ok:false,error:"method_not_allowed"});
    await ensureSchema();
    const sql=client();

    const runs=await sql(
      `select l.id,l.account_id,l.sample_count,l.confidence,l.status,l.summary,l.created_at,
        a.name as account_name,a.handle
       from roader_learning_runs l
       join roader_accounts a on a.id=l.account_id
       order by l.created_at desc
       limit 150`
    );

    const profiles=await sql(
      `select p.account_id,p.strategy,p.sample_count,p.confidence,p.last_metric_at,p.last_learned_at,p.updated_at,
        a.name as account_name,a.handle
       from roader_performance_profiles p
       join roader_accounts a on a.id=p.account_id
       order by p.updated_at desc`
    );

    return res.status(200).json({ok:true,runs,profiles});
  }catch(error){
    console.error("learning-logs",error);
    return res.status(500).json({ok:false,error:"server_error",details:String(error?.message||"")});
  }
}
