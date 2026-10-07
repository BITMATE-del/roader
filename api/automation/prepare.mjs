export default async function handler(req,res){
  try{
    if(req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});
    const secret=process.env.CRON_SECRET||"";
    if(!secret) return res.status(503).json({ok:false,error:"cron_secret_not_configured"});

    const proto=String(req.headers["x-forwarded-proto"]||"https").split(",")[0];
    const host=String(req.headers["x-forwarded-host"]||req.headers.host||"");
    const origin=`${proto}://${host}`;

    const r=await fetch(origin+"/api/automation/run",{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "authorization":`Bearer ${secret}`
      },
      body:"{}"
    });
    const data=await r.json().catch(()=>({}));
    return res.status(r.ok?200:r.status).json(data);
  }catch(error){
    console.error("automation-prepare",error);
    return res.status(500).json({ok:false,error:"prepare_failed",details:String(error?.message||"")});
  }
}
