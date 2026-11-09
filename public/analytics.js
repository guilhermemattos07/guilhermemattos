globalThis.FeedbackAnalytics=(()=>{
 const valid=(v,min=0,max=10)=>(typeof v==='number'||typeof v==='string'&&/^\d+$/.test(v))&&Number.isInteger(Number(v))&&Number(v)>=min&&Number(v)<=max;
 const average=(rows,key,min=0,max=10)=>{const v=rows.map(r=>r.answers?.[key]).filter(v=>valid(v,min,max)).map(Number);return {n:v.length,value:v.length?v.reduce((a,b)=>a+b,0)/v.length:null};};
 const nps=rows=>{const scores=rows.map(r=>r.answers?.nps).filter(v=>valid(v)).map(Number),n=scores.length,promoters=scores.filter(v=>v>=9).length,detractors=scores.filter(v=>v<=6).length,passives=n-promoters-detractors;return {n,promoters,detractors,passives,missing:rows.length-n,value:n?100*(promoters-detractors)/n:null,promoterPct:n?100*promoters/n:0,passivePct:n?100*passives/n:0,detractorPct:n?100*detractors/n:0};};
 const count=(rows,key)=>{const out={};for(const r of rows){const v=r.answers?.[key];for(const item of Array.isArray(v)?v:v?[v]:[])out[item]=(out[item]||0)+1;}return Object.entries(out).sort((a,b)=>b[1]-a[1]);};
 const csvValue=v=>{let text=String(v??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
 const csv=rows=>'\ufeff'+rows.map(row=>row.map(csvValue).join(';')).join('\r\n');
 const day=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
 return {valid,average,nps,count,csv,day};
})();
