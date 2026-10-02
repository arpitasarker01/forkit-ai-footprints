import fs from "node:fs";
import path from "node:path";
const root=path.resolve("site");
const pages=["index.html","footprint/index.html","action-assurance/index.html","how-it-works/index.html","reconstruct/index.html","contact/index.html"];
let failed=false;
function check(cond,msg){if(!cond){console.error("FAIL:",msg);failed=true}else console.log("PASS:",msg)}
for(const p of pages){
 const f=path.join(root,p);check(fs.existsSync(f),p+" exists");if(!fs.existsSync(f))continue;
 const html=fs.readFileSync(f,"utf8");
 check(/<title>[^<]+<\/title>/.test(html),p+" has title");
 check(/name="description"/.test(html),p+" has description");
 check(/rel="canonical"/.test(html),p+" has canonical");
 check(/property="og:title"/.test(html),p+" has Open Graph");
 check(/name="twitter:card"/.test(html),p+" has Twitter card");
}
const all=pages.map(p=>fs.readFileSync(path.join(root,p),"utf8")).join("\n");
check(!all.includes("forkit.dev/session-receipt"),"no session-receipt dependency");
check(all.includes("forkit-reconstruct.floot.app"),"reconstruct live experiment linked");
check(all.includes("partnership@forkit.dev"),"partnership contact present");
check(all.includes("developers@forkit.dev"),"developer contact present");
check(all.includes("SIMULATED"),"simulated functionality is labelled");
check(all.includes("PLANNED"),"planned functionality is labelled");
check(all.includes("PROTOTYPE"),"prototype functionality is labelled");
check(fs.existsSync(path.join(root,"robots.txt")),"robots.txt exists");
check(fs.existsSync(path.join(root,"sitemap.xml")),"sitemap.xml exists");
check(fs.existsSync("firebase.json"),"Firebase Hosting config exists");
if(failed)process.exit(1);
