import { ensureSchema, client } from "../_db.mjs";

export default async function handler(req,res){
  try{
    await ensureSchema();
    const sql=client();

    if(req.method==="GET"){
      const limit=Math.max(1,Math.min(200,Number(req.query?.limit||100)));
      const rows=await sql(
        `select id,provider,external_id,event_kind,event_time,country,category,event_name,importance,
          actual,previous,forecast,unit,source_url,status,result_detected_at,alert_sent_at,
          ai_summary,ai_classification,market_impact,created_at,updated_at
         from roader_economic_events
         order by coalesce(event_time,created_at) desc
         limit $1`,
        [limit]
      );
      return res.status(200).json({ok:true,events:rows});
    }

    return res.status(405).json({ok:false,error:"method_not_allowed"});
  }catch(error){
    console.error("economy-events",error);
    return res.status(500).json({ok:false,error:"server_error"});
  }
}
