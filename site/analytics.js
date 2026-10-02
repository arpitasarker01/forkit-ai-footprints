(() => {
  const cfg=window.FORKIT_SITE_CONFIG||{};
  const endpoint=typeof cfg.analyticsEndpoint==="string"?cfg.analyticsEndpoint.trim():"";
  const page=document.body?.dataset?.page||location.pathname;
  const key="forkit_ai_session";
  let session=sessionStorage.getItem(key);
  if(!session){session=crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2);sessionStorage.setItem(key,session)}
  function source(){const p=new URLSearchParams(location.search),u=p.get("utm_source");if(u)return u.slice(0,80);try{if(document.referrer)return new URL(document.referrer).hostname.slice(0,120)}catch(_){}return "direct"}
  function send(name,meta={}){
    const payload={v:1,name,page,path:location.pathname,source:source(),session,ts:new Date().toISOString(),meta};
    window.dispatchEvent(new CustomEvent("forkit:analytics",{detail:payload}));
    if(!endpoint)return;
    const body=JSON.stringify(payload);
    try{if(navigator.sendBeacon)navigator.sendBeacon(endpoint,new Blob([body],{type:"application/json"}));else fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body,keepalive:true,credentials:"omit"})}catch(_){}
  }
  send("page_view");
  document.addEventListener("click",e=>{const el=e.target.closest("[data-analytics]");if(el)send(el.dataset.analytics,{label:(el.textContent||"").trim().slice(0,120)})});
  window.ForkitAnalytics={send};
})();