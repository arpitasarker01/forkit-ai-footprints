const copy=document.getElementById("copy"),install=document.getElementById("install");
copy?.addEventListener("click",async()=>{await navigator.clipboard.writeText(install.textContent);copy.textContent="Copied";setTimeout(()=>copy.textContent="Copy",1400)});
(async()=>{try{
 const [d,p]=await Promise.all([
   fetch("https://api.npmjs.org/downloads/point/last-month/forkit-ai-footprints").then(r=>r.ok?r.json():null),
   fetch("https://registry.npmjs.org/forkit-ai-footprints/latest").then(r=>r.ok?r.json():null)
 ]);
 if(d&&Number.isFinite(d.downloads)) document.getElementById("downloads").textContent=d.downloads.toLocaleString();
 if(p&&p.version) document.getElementById("version").textContent="v"+p.version;
}catch(_){}})();