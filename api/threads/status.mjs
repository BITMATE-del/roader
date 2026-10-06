import { ensureSchema, client } from "./_db.mjs";

export default async function handler(req,res){
  try{
    await ensureSchema();
    const sql=client();

    if(req.method!=="GET") return res.status(405).json({ok:false,error:"method_not_allowed"});

    const accountId=Number(req.query?.account_id||0);
    if(!accountId) return res.status(400).json({ok:false,error:"account_id_required"});

    const rows=await sql(
      "select id,name,handle,threads_user_id,(threads_access_token_encrypted is not null and threads_access_token_encrypted<>'') as connected from roader_accounts where id=$1",
      [accountId]
    );

    return res.status(200).json({ok:true,account:rows[0]||null});
  }catch(error){
    console.error("threads-status",error);
    return res.status(500).json({ok:false,error:"server_error"});
  }
}
