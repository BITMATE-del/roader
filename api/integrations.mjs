async function telegramStatus(){
  const configured=Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.ADMIN_CHAT_ID && process.env.WEBHOOK_SECRET);
  if(!configured){
    return {configured:false,connected:false,webhook_url:""};
  }

  try{
    const r=await fetch("https://api.telegram.org/bot"+process.env.TELEGRAM_BOT_TOKEN+"/getWebhookInfo");
    const data=await r.json();
    const info=data?.result||{};
    return {
      configured:true,
      connected:Boolean(data?.ok && info.url==="https://roader-delta.vercel.app/api/telegram"),
      webhook_url:info.url||"",
      pending_update_count:Number(info.pending_update_count||0),
      last_error_message:info.last_error_message||""
    };
  }catch{
    return {configured:true,connected:false,webhook_url:"",status_error:true};
  }
}

export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({ok:false,error:"method_not_allowed"});

  const telegram=await telegramStatus();

  return res.status(200).json({
    ok:true,
    threads:{
      configured:Boolean(process.env.META_THREADS_APP_ID && process.env.META_THREADS_APP_SECRET)
    },
    ai:{
      configured:Boolean(process.env.OPENAI_API_KEY)
    },
    telegram
  });
}
