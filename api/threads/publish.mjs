import { ensureSchema, client } from "../_db.mjs";

async function graphPost(url, params){
  const response=await fetch(url,{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams(params)
  });
  const data=await response.json().catch(()=>({}));
  return {response,data};
}

export default async function handler(req,res){
  let postId=null;
  try{
    if(req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});

    const body=req.body||{};
    const accountId=Number(body.account_id||0);
    const text=String(body.body||"").trim();
    const mediaMode=String(body.media_mode||"text");

    if(!accountId||!text) return res.status(400).json({ok:false,error:"account_id_and_body_required"});
    if(mediaMode!=="text") return res.status(400).json({ok:false,error:"text_only_for_now"});

    await ensureSchema();
    const sql=client();

    const accounts=await sql(
      "select id,name,handle,threads_user_id,threads_access_token_encrypted from roader_accounts where id=$1",
      [accountId]
    );
    const account=accounts[0];
    if(!account?.threads_user_id||!account?.threads_access_token_encrypted){
      return res.status(400).json({ok:false,error:"threads_account_not_connected"});
    }

    const inserted=await sql(
      "insert into roader_posts (account_id,post_type,media_mode,body,quality_score,quality_status,quality_details,status,source_code) values ($1,$2,$3,$4,$5,$6,$7::jsonb,'publishing',$8) returning id",
      [
        accountId,
        String(body.post_type||"정보형"),
        mediaMode,
        text,
        body.quality_score??null,
        body.quality_status??null,
        JSON.stringify(body.quality_details||{}),
        String(account.handle||"").replace(/^@/,"")
      ]
    );
    postId=inserted[0]?.id||null;

    const token=String(account.threads_access_token_encrypted);
    const userId=String(account.threads_user_id);

    const create=await graphPost(
      `https://graph.threads.net/v1.0/${encodeURIComponent(userId)}/threads`,
      {media_type:"TEXT",text,access_token:token}
    );
    if(!create.response.ok||!create.data?.id){
      if(postId) await sql("update roader_posts set status='failed',updated_at=now() where id=$1",[postId]);
      console.error("threads-create",create.data);
      return res.status(502).json({ok:false,error:"threads_create_failed",details:create.data?.error?.message||create.data?.error_message||null});
    }

    const publish=await graphPost(
      `https://graph.threads.net/v1.0/${encodeURIComponent(userId)}/threads_publish`,
      {creation_id:String(create.data.id),access_token:token}
    );
    if(!publish.response.ok||!publish.data?.id){
      if(postId) await sql("update roader_posts set status='failed',updated_at=now() where id=$1",[postId]);
      console.error("threads-publish",publish.data);
      return res.status(502).json({ok:false,error:"threads_publish_failed",details:publish.data?.error?.message||publish.data?.error_message||null});
    }

    const threadsPostId=String(publish.data.id);
    if(postId){
      await sql(
        "update roader_posts set status='published',threads_post_id=$1,published_at=now(),updated_at=now() where id=$2",
        [threadsPostId,postId]
      );
    }

    return res.status(200).json({ok:true,post_id:postId,threads_post_id:threadsPostId});
  }catch(error){
    console.error("threads-publish-handler",error);
    try{
      if(postId){
        const sql=client();
        await sql("update roader_posts set status='failed',updated_at=now() where id=$1",[postId]);
      }
    }catch{}
    return res.status(500).json({ok:false,error:"server_error"});
  }
}
