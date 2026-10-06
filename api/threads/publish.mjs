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

function metaError(data){
  return data?.error?.message||data?.error_message||data?.message||null;
}

export default async function handler(req,res){
  let postId=null;
  try{
    if(req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});

    const body=req.body||{};
    const accountId=Number(body.account_id||0);
    const text=String(body.body||"").trim();
    const replyText=String(body.reply_text||"").trim();
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

    const publish=await graphPost(
      "https://graph.threads.net/v1.0/me/threads",
      {
        media_type:"TEXT",
        text,
        auto_publish_text:"true",
        access_token:token
      }
    );

    if(!publish.response.ok||!publish.data?.id){
      if(postId) await sql("update roader_posts set status='failed',updated_at=now() where id=$1",[postId]);
      const details=metaError(publish.data);
      const code=publish.data?.error?.code||publish.data?.error_code||null;
      console.error("threads-auto-publish",publish.data);
      return res.status(502).json({ok:false,error:"threads_publish_failed",details,code});
    }

    const threadsPostId=String(publish.data.id);

    if(postId){
      await sql(
        "update roader_posts set status='published',threads_post_id=$1,published_at=now(),updated_at=now() where id=$2",
        [threadsPostId,postId]
      );
    }

    if(!replyText){
      return res.status(200).json({
        ok:true,
        post_id:postId,
        threads_post_id:threadsPostId,
        reply_attempted:false,
        reply_ok:false
      });
    }

    const reply=await graphPost(
      "https://graph.threads.net/v1.0/me/threads",
      {
        media_type:"TEXT",
        text:replyText,
        reply_to_id:threadsPostId,
        auto_publish_text:"true",
        access_token:token
      }
    );

    if(!reply.response.ok||!reply.data?.id){
      const replyDetails=metaError(reply.data);
      const replyCode=reply.data?.error?.code||reply.data?.error_code||null;
      console.error("threads-reply",reply.data);

      if(postId){
        const replyState={
          attempted:true,
          ok:false,
          text:replyText,
          error:replyDetails,
          code:replyCode
        };
        await sql(
          "update roader_posts set quality_details=coalesce(quality_details,'{}'::jsonb) || jsonb_build_object('thread_reply',$1::jsonb),updated_at=now() where id=$2",
          [JSON.stringify(replyState),postId]
        );
      }

      return res.status(200).json({
        ok:true,
        post_id:postId,
        threads_post_id:threadsPostId,
        reply_attempted:true,
        reply_ok:false,
        reply_details:replyDetails,
        reply_code:replyCode
      });
    }

    const threadsReplyId=String(reply.data.id);
    if(postId){
      const replyState={
        attempted:true,
        ok:true,
        text:replyText,
        threads_reply_id:threadsReplyId
      };
      await sql(
        "update roader_posts set quality_details=coalesce(quality_details,'{}'::jsonb) || jsonb_build_object('thread_reply',$1::jsonb),updated_at=now() where id=$2",
        [JSON.stringify(replyState),postId]
      );
    }

    return res.status(200).json({
      ok:true,
      post_id:postId,
      threads_post_id:threadsPostId,
      reply_attempted:true,
      reply_ok:true,
      threads_reply_id:threadsReplyId
    });
  }catch(error){
    console.error("threads-publish-handler",error);
    try{
      if(postId){
        const sql=client();
        await sql("update roader_posts set status='failed',updated_at=now() where id=$1",[postId]);
      }
    }catch{}
    return res.status(500).json({ok:false,error:"server_error",details:String(error?.message||"")});
  }
}
