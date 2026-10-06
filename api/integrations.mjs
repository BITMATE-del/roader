export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({ok:false,error:"method_not_allowed"});
  return res.status(200).json({
    ok:true,
    threads:{
      configured:Boolean(process.env.THREADS_ACCESS_TOKEN),
      required_permission:"threads_profile_discovery"
    },
    ai:{
      configured:Boolean(process.env.OPENAI_API_KEY)
    }
  });
}
