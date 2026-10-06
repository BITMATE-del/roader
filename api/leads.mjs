import { ensureSchema, client } from "./_db.mjs";

export default async function handler(req,res){
  try{
    await ensureSchema();
    const sql=client();

    if(req.method==="GET"){
      const rows=await sql(`
        select l.*,p.body as source_post_body,a.name as source_account_name
        from roader_leads l
        left join roader_posts p on p.id=l.source_post_id
        left join roader_accounts a on a.id=p.account_id
        order by l.created_at desc
        limit 200
      `);
      return res.status(200).json({ok:true,leads:rows});
    }

    if(req.method==="PATCH"){
      const b=req.body||{};
      if(!b.id) return res.status(400).json({ok:false,error:"id_required"});
      const rows=await sql(
        "update roader_leads set status=$1,processed_by=$2,processed_at=now() where id=$3 returning *",
        [String(b.status||"pending"),String(b.processed_by||"admin"),Number(b.id)]
      );
      return res.status(200).json({ok:true,lead:rows[0]||null});
    }

    return res.status(405).json({ok:false,error:"method_not_allowed"});
  }catch(error){
    console.error("leads-api",error);
    return res.status(500).json({ok:false,error:"server_error"});
  }
}
