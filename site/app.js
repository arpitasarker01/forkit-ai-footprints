(() => {
  const demos = {
    developer: {
      title: "Claude Code → project result",
      assurance: "PARTIAL",
      note: "Simulated example. It demonstrates the Action model; it is not a claim that current Footprint reconstructs these links end-to-end.",
      chain: [
        ["01","ACTOR","Developer"],
        ["02","AGENT","Claude Code"],
        ["03","MODEL","Claude"],
        ["04","TOOLS","Terminal · MCP · GitHub"],
        ["05","OBJECT","Project activity"],
        ["06","RESULT","Code change"]
      ],
      evidence: [
        ["Agent process","DIRECT"],
        ["Model/provider","SUPPORTED"],
        ["Tool interaction","INFERRED"],
        ["Project result","SUPPORTED"],
        ["Human approval context","MISSING"]
      ]
    },
    enterprise: {
      title: "Purchase order commitment",
      assurance: "PARTIAL",
      note: "Simulated enterprise example. The record preserves the missing approval instead of silently assuming authorization.",
      chain: [
        ["01","ACTOR","Human requester"],
        ["02","AUTHORITY","Approval ?"],
        ["03","AGENT","Purchasing agent"],
        ["04","MODEL","Claude"],
        ["05","IDENTITY","svc-procurement"],
        ["06","TOOL","create_purchase_order"],
        ["07","SYSTEM","SAP"],
        ["08","RESULT","PO #91821 · €18,400"]
      ],
      evidence: [
        ["Agent trace","DIRECT"],
        ["Identity","SUPPORTED"],
        ["Tool request","DIRECT"],
        ["SAP write","DIRECT"],
        ["Approval","MISSING"]
      ]
    }
  };

  function renderDemo(mode) {
    const d = demos[mode] || demos.developer;
    const chain = document.getElementById("demoChain");
    const evidence = document.getElementById("demoEvidence");
    if (!chain || !evidence) return;
    chain.innerHTML = d.chain.map((n,i) => `<div class="chain-node"><b>${n[0]}</b><strong>${n[1]}</strong><small>${n[2]}</small></div>${i < d.chain.length-1 ? '<i class="chain-arrow"></i>' : ''}`).join("");
    evidence.innerHTML = d.evidence.map(([label,state]) => `<div class="evidence-row"><span>${label}</span><span class="${state.toLowerCase()}">${state}</span></div>`).join("");
    document.getElementById("demoTitle").textContent = d.title;
    document.getElementById("demoAssurance").textContent = d.assurance;
    document.getElementById("demoNote").textContent = d.note;
    document.querySelectorAll("[data-demo-tab]").forEach(el => el.classList.toggle("active", el.dataset.demoTab === mode));
  }

  const p = new URLSearchParams(location.search);
  renderDemo(p.get("demo") === "enterprise" ? "enterprise" : "developer");
})();