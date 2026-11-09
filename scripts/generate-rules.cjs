const fs=require('node:fs'),vm=require('node:vm');
vm.runInThisContext(fs.readFileSync('public/formulario/questions.js','utf8'));
const rules={};for(const role of Object.keys(RCLM.roles)){rules[role]={};for(const step of [1,2,3,4])for(const q of RCLM.questions(role,step)){
 if(q.type==='matrix')for(const row of q.rows)rules[role][row.id]={options:['1','2','3','4','5',RCLM.NA]};
 else if(q.type==='score')rules[role][q.id]={options:[...Array.from({length:11},(_,i)=>String(i)),'Não sei avaliar']};
 else if(q.type==='textarea')rules[role][q.id]={type:'text'};
 else if(q.type==='checkbox')rules[role][q.id]={type:'multiple',options:q.options,max:q.max,exclusive:q.exclusive};
 else if(q.type==='radio')rules[role][q.id]={options:q.options};
}}
const catalog=JSON.parse(fs.readFileSync('public/formulario/criteria.json','utf8'));rules.criteria=Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,v.map(x=>x.code)]));
fs.writeFileSync('src/feedback-rules.json',JSON.stringify(rules,null,2)+'\n');
