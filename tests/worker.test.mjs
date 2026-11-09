import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import worker from '../src/index.js';
import {validateFeedback} from '../src/validate-feedback.js';

const origin='https://feedback.example.test';
const adminKey='a'.repeat(64); // Credencial fictícia exclusiva dos testes.
function fixture(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_feedback.sql',import.meta.url),'utf8'));
  const DB={
    prepare(sql){let values=[];const statement=sqlite.prepare(sql);return {
      bind(...params){values=params;return this;},
      async first(){return statement.get(...values)||null;},
      async all(){return {results:statement.all(...values)};},
      async run(){const result=statement.run(...values);return {success:true,meta:{changes:Number(result.changes)}};}
    };},
    async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}
  };
  const env={DB,ADMIN_KEY:adminKey,ASSETS:{fetch:async()=>new Response('asset')}};
  const call=(path,method='GET',data,headers={})=>worker.fetch(new Request(origin+path,{method,headers:{...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
  return {sqlite,env,call};
}
async function login(f){const response=await f.call('/api/session','POST',{key:adminKey});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];}
async function openCollection(f,cookie){
  const response=await f.call('/api/admin/settings','PATCH',{privacy:{controller:'Organização de teste',contact:'privacidade@example.test',retentionDays:90},confirmed:true},{cookie});
  assert.equal(response.status,200);const config=await response.json();
  assert.equal((await f.call('/api/admin/settings','PATCH',{collectionOpen:true},{cookie})).status,200);
  return config.privacy;
}
function payload(role='gabinete',privacyVersion='2026-test'){
  return {role,submissionId:crypto.randomUUID(),withdrawalToken:'b'.repeat(64),identity:{},answers:{nps:'0'},suggestions:[],consent:true,privacyVersion};
}
test('painel e APIs exigem sessão; cabeçalhos antigos não dão acesso',async()=>{
  const f=fixture();
  for(const path of ['/painel','/painel/','/painel.html']){const response=await f.call(path);assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/entrar.html');}
  assert.equal((await f.call('/painel.html?demo=1')).status,200);
  for(const [path,method] of [['/api/admin/responses','GET'],['/api/admin/responses','PATCH'],['/api/admin/responses','DELETE'],['/api/admin/settings','PATCH']]){
    const response=await f.call(path,method,method==='GET'?undefined:{},{'x-openai-user-id':'owner','x-chatgpt-user-id':'owner'});assert.equal(response.status,401);
  }
  f.env.ADMIN_KEY='';assert.equal((await f.call('/api/session','POST',{key:adminKey})).status,503);f.sqlite.close();
});
test('login valida origem e chave; cookie seguro; token não fica em texto no banco',async()=>{
  const f=fixture();assert.equal((await f.call('/api/session','POST',{key:adminKey},{Origin:'https://other.example'})).status,403);
  assert.equal((await f.call('/api/session','POST',{key:'incorreta'})).status,401);
  const response=await f.call('/api/session','POST',{key:adminKey});assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(cookie.includes(flag));
  const token=cookie.split(';')[0].split('=')[1],row=f.sqlite.prepare('SELECT * FROM admin_sessions').get();
  assert.notEqual(row.token_hash,token);assert.notEqual(row.key_hash,adminKey);assert.equal(row.token_hash.length,64);
  assert.equal((await f.call('/api/admin/responses','GET',undefined,{cookie})).status,200);
  assert.equal((await f.call('/painel.html','GET',undefined,{cookie})).status,200);f.sqlite.close();
});
test('logout, expiração e troca de chave revogam as sessões',async()=>{
  const f=fixture();let cookie=await login(f);
  assert.equal((await f.call('/api/session','DELETE',undefined,{cookie})).status,200);
  assert.equal((await f.call('/api/admin/responses','GET',undefined,{cookie})).status,401);
  cookie=await login(f);f.sqlite.exec('UPDATE admin_sessions SET expires_at=0');assert.equal((await f.call('/api/admin/responses','GET',undefined,{cookie})).status,401);
  cookie=await login(f);f.env.ADMIN_KEY='c'.repeat(64);assert.equal((await f.call('/api/admin/responses','GET',undefined,{cookie})).status,401);f.sqlite.close();
});
test('entrada limita tentativas e tamanho da requisição',async()=>{
  const f=fixture();assert.equal((await f.call('/api/session','POST',{key:'x'.repeat(1200)})).status,413);
  for(let i=0;i<10;i++)assert.equal((await f.call('/api/session','POST',{key:'errada'})).status,401);
  assert.equal((await f.call('/api/session','POST',{key:adminKey})).status,429);f.sqlite.close();
});
test('coleta inicia pausada e só abre após revisão de privacidade',async()=>{
  const f=fixture();const config=await (await f.call('/api/config')).json();assert.equal(config.collectionOpen,false);assert.equal(config.privacy,null);
  assert.equal((await f.call('/api/responses','POST',payload())).status,409);
  const cookie=await login(f);assert.equal((await f.call('/api/admin/settings','PATCH',{collectionOpen:true},{cookie})).status,409);
  assert.equal((await f.call('/api/admin/settings','PATCH',{privacy:{controller:'',contact:'',retentionDays:90},confirmed:true},{cookie})).status,400);
  await openCollection(f,cookie);assert.equal((await (await f.call('/api/config')).json()).collectionOpen,true);f.sqlite.close();
});
for(const role of ['gabinete','camara','organizacao'])test(`grava resposta anônima de ${role} e preserva NPS zero`,async()=>{
  const f=fixture(),cookie=await login(f),privacy=await openCollection(f,cookie),data=payload(role,privacy.version);
  data.answers[`projeto_${role}_1`]='4';data.answers[`regras_${role}_1`]='5';
  assert.equal((await f.call('/api/responses','POST',data)).status,201);
  const listed=await (await f.call('/api/admin/responses','GET',undefined,{cookie})).json();
  assert.equal(listed.rows.length,1);assert.equal(listed.rows[0].answers.nps,'0');assert.deepEqual(listed.rows[0].identity,{});assert.equal(listed.rows[0].formVersion,'2026-v3');
  assert.equal(listed.rows[0].consent.notice.version,privacy.version);assert.ok(listed.rows[0].expiresAt);assert.equal(JSON.stringify(listed).includes(data.withdrawalToken),false);f.sqlite.close();
});
test('consentimento, versão do aviso e origem são verificados no servidor',async()=>{
  const f=fixture(),cookie=await login(f),privacy=await openCollection(f,cookie),data=payload('gabinete',privacy.version);
  assert.equal((await f.call('/api/responses','POST',{...data,consent:false})).status,400);
  assert.equal((await f.call('/api/responses','POST',{...data,privacyVersion:'antiga'})).status,409);
  assert.equal((await f.call('/api/responses','POST',data,{Origin:'https://other.example'})).status,403);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM responses').get().n,0);f.sqlite.close();
});
test('envio repetido não duplica e colisão não revela resposta',async()=>{
  const f=fixture(),cookie=await login(f),privacy=await openCollection(f,cookie),data=payload('camara',privacy.version);
  assert.equal((await f.call('/api/responses','POST',data)).status,201);assert.equal((await f.call('/api/responses','POST',data)).status,200);
  assert.equal((await f.call('/api/responses','POST',{...data,withdrawalToken:'e'.repeat(64)})).status,409);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM responses').get().n,1);f.sqlite.close();
});
test('comprovante permite excluir apenas a resposta correspondente',async()=>{
  const f=fixture(),cookie=await login(f),privacy=await openCollection(f,cookie),data=payload('gabinete',privacy.version);
  await f.call('/api/responses','POST',data);
  assert.equal((await f.call('/api/withdraw','POST',{id:data.submissionId,token:'e'.repeat(64)})).status,404);
  assert.equal((await f.call('/api/withdraw','POST',{id:data.submissionId,token:data.withdrawalToken})).status,200);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM responses').get().n,0);f.sqlite.close();
});
test('admin registra análise e exclui com confirmação; prazo de guarda é aplicado',async()=>{
  const f=fixture(),cookie=await login(f),privacy=await openCollection(f,cookie),data=payload('organizacao',privacy.version);
  await f.call('/api/responses','POST',data);
  assert.equal((await f.call('/api/admin/responses','PATCH',{id:data.submissionId,reviewStatus:'analisada',adminNote:'Comentário de teste'},{cookie})).status,200);
  assert.equal(f.sqlite.prepare('SELECT review_status FROM responses').get().review_status,'analisada');
  assert.equal((await f.call('/api/admin/responses','DELETE',{id:data.submissionId,confirm:false},{cookie})).status,400);
  assert.equal((await f.call('/api/admin/responses','DELETE',{id:data.submissionId,confirm:true},{cookie})).status,200);
  data.submissionId=crypto.randomUUID();await f.call('/api/responses','POST',data);f.sqlite.exec("UPDATE responses SET expires_at='2020-01-01T00:00:00.000Z'");
  await f.call('/api/config');assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM responses').get().n,0);f.sqlite.close();
});
test('validação rejeita município externo, perfil incompatível e opções inválidas',()=>{
  const data=payload();
  assert.throws(()=>validateFeedback({...data,identity:{municipio:'Outro'}}));
  assert.throws(()=>validateFeedback({...data,answers:{projeto_camara_1:'5'}}));
  assert.throws(()=>validateFeedback({...data,answers:{nps:'11'}}));
  assert.throws(()=>validateFeedback({...data,answers:JSON.parse('{"__proto__":"1"}')}));
  assert.throws(()=>validateFeedback({...data,answers:{desafios:['Cumprir os prazos','Reunir as informações solicitadas','Entender os resultados recebidos']}}));
  assert.throws(()=>validateFeedback({...data,answers:{desafios:['Não enfrentei dificuldades','Cumprir os prazos']}}));
});
test('campos condicionais são limpos e sugestões respeitam o público',()=>{
  const data=payload();const suggestion={target:'gabinete',proposal:'Simplificar as orientações',reason:'Facilitar o preenchimento',code:'',type:''};
  assert.equal(validateFeedback({...data,answers:{ajustes:'Sim'},suggestions:[suggestion]}).suggestions.length,1);
  assert.equal(validateFeedback({...data,answers:{ajustes:'Não tenho ajustes a sugerir'},suggestions:[suggestion]}).suggestions.length,0);
  assert.equal(validateFeedback({...data,answers:{desafios:['Não enfrentei dificuldades'],desafio_detalhe:'Texto anterior'}}).answers.desafio_detalhe,undefined);
  assert.throws(()=>validateFeedback({...data,answers:{ajustes:'Sim'},suggestions:[{...suggestion,target:'camara'}]}));
});
test('NPS usa apenas notas válidas e CSV neutraliza fórmulas',()=>{
  const context=vm.createContext({Intl,Date});vm.runInContext(readFileSync(new URL('../public/analytics.js',import.meta.url),'utf8'),context);
  const analytics=context.FeedbackAnalytics;const nps=analytics.nps([0,7,9,10,null,'Não sei avaliar',''].map(nps=>({answers:{nps}})));
  assert.equal(nps.n,4);assert.equal(nps.value,25);assert.equal(nps.missing,3);assert.equal(analytics.nps([]).value,null);
  assert.equal(analytics.nps([{answers:{nps:0}}]).value,-100);assert.equal(analytics.nps([{answers:{nps:10}}]).value,100);
  assert.ok(analytics.csv([['=1+1','ação;teste']]).includes('"\'=1+1"'));assert.ok(analytics.csv([['a"b']]).includes('"a""b"'));
});
test('regras do servidor acompanham os três percursos simplificados',()=>{
  const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../public/formulario/questions.js',import.meta.url),'utf8'),context);
  for(const role of Object.keys(context.RCLM.roles))for(const step of [1,2,3,4])for(const question of context.RCLM.questions(role,step)){
    if(question.type==='matrix')for(const row of question.rows)assert.equal(validateFeedback({...payload(role),answers:{[row.id]:'5'}}).answers[row.id],'5');
    else if(question.type==='textarea')assert.equal(validateFeedback({...payload(role),answers:{[question.id]:'Teste'}}).answers[question.id],question.id==='desafio_detalhe'?undefined:'Teste');
  }
});
