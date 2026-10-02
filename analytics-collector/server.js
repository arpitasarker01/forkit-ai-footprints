const http=require("node:http");
const crypto=require("node:crypto");
const allowed=new Set(["page_view","footprint_interest","reconstruct_click","reconstruct_launch","demo_developer","demo_enterprise","enterprise_interest","contact_intent","developer_interest","footprint_install_copy"]);
const clip=(v,n)=>typeof v==="string"?v.slice(0,n):"";
const server=http.createServer((req,res)=>{
  if(req.method==="GET"&&(req.url==="/"||req.url==="/health")){res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});return res.end('{"ok":true}');}
  if(req.method!=="POST"||!(req.url==="/"||req.url==="/events")){res.writeHead(404);return res.end();}
  let size=0,body="";
  req.on("data",chunk=>{size+=chunk.length;if(size>4096){res.writeHead(413);res.end();req.destroy();return;}body+=chunk;});
  req.on("end",()=>{
    if(res.writableEnded)return;
    try{
      const x=JSON.parse(body||"{}");
      if(x.v!==1||!allowed.has(x.name)){res.writeHead(400);return res.end();}
      const session=clip(x.session,128);
      const event={
        type:"forkit_site_event",
        event:x.name,
        page:clip(x.page,80),
        path:clip(x.path,160),
        source:clip(x.source,120),
        session_hash:session?crypto.createHash("sha256").update(session).digest("hex").slice(0,24):"",
        label:clip(x.meta&&x.meta.label,120),
        ts:new Date().toISOString()
      };
      console.log(JSON.stringify(event));
      res.writeHead(204,{"cache-control":"no-store"});res.end();
    }catch(_){res.writeHead(400);res.end();}
  });
});
server.listen(process.env.PORT||8080,"0.0.0.0");
