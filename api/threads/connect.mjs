const APP_ID = process.env.META_THREADS_APP_ID;
const REDIRECT_URI = process.env.META_THREADS_REDIRECT_URI;

export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({ok:false,error:"method_not_allowed"});
  if(!APP_ID || !REDIRECT_URI) return res.status(503).json({ok:false,error:"meta_threads_not_configured"});

  const state = String(req.query?.state || "roader");
  const scope = [
    "threads_basic",
    "threads_content_publish",
    "threads_manage_insights"
  ].join(",");

  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id",APP_ID);
  url.searchParams.set("redirect_uri",REDIRECT_URI);
  url.searchParams.set("scope",scope);
  url.searchParams.set("response_type","code");
  url.searchParams.set("state",state);

  return res.status(200).json({ok:true,url:url.toString()});
}
