const COOKIE='__Host-rclm_session';
const SESSION_SECONDS=8*60*60;
const encoder=new TextEncoder();
export const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const configured=env=>typeof env.ADMIN_KEY==='string'&&/^[a-f0-9]{64}$/i.test(env.ADMIN_KEY);
const now=()=>Math.floor(Date.now()/1000);
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export const hash=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const cookie=(value,age)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const tokenFrom=request=>request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
const sameOrigin=request=>request.headers.get('origin')===new URL(request.url).origin;
const equal=(a,b)=>{let difference=a.length^b.length;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return difference===0;};
export async function authenticate(request,env){
  if(!configured(env))return {error:json({error:'O acesso administrativo ainda precisa ser configurado.',signin:'/entrar.html'},401)};
  const token=tokenFrom(request);
  if(!/^[a-f0-9]{64}$/.test(token))return {error:json({error:'Entre com sua chave de acesso para abrir o painel.',signin:'/entrar.html'},401)};
  const session=await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash=? AND key_hash=? AND expires_at>?').bind(await hash(token),await hash(env.ADMIN_KEY),now()).first();
  if(!session)return {error:json({error:'Sua sessão terminou. Entre novamente.',signin:'/entrar.html'},401)};
  return {user:{displayName:'Administração do projeto'}};
}
export async function login(request,env){
  if(!sameOrigin(request))return json({error:'Origem inválida.'},403);
  if(!configured(env))return json({error:'Configure ADMIN_KEY como segredo na Cloudflare. Use as instruções de primeiro acesso abaixo.'},503);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido.'},400);
  const reader=request.body?.getReader();if(!reader)return json({error:'Informe sua chave.'},400);
  let bytes=new Uint8Array();
  while(true){const {value,done}=await reader.read();if(done)break;if(bytes.length+value.length>1024){await reader.cancel();return json({error:'Conteúdo muito grande.'},413);}const next=new Uint8Array(bytes.length+value.length);next.set(bytes);next.set(value,bytes.length);bytes=next;}
  let supplied;try{supplied=JSON.parse(new TextDecoder().decode(bytes)).key;}catch{return json({error:'Informe sua chave.'},400);}
  if(typeof supplied!=='string'||supplied.length>128)return json({error:'Chave inválida.'},400);
  const time=now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(time),
    env.DB.prepare('DELETE FROM login_attempts WHERE expires_at<=?').bind(time)
  ]);
  const bucket=await hash(env.ADMIN_KEY+'|'+(request.headers.get('CF-Connecting-IP')||'local')+'|'+Math.floor(time/900));
  const attempt=await env.DB.prepare('INSERT INTO login_attempts (bucket,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(bucket,time+900).first();
  if(attempt.attempts>10)return json({error:'Muitas tentativas. Aguarde 15 minutos e tente novamente.'},429,{'Retry-After':'900'});
  if(!equal(await hash(supplied),await hash(env.ADMIN_KEY)))return json({error:'Chave incorreta. Confira e tente novamente.'},401);
  const token=randomToken();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO admin_sessions (token_hash,key_hash,expires_at) VALUES (?,?,?)').bind(await hash(token),await hash(env.ADMIN_KEY),time+SESSION_SECONDS),
    env.DB.prepare('DELETE FROM login_attempts WHERE bucket=?').bind(bucket)
  ]);
  return json({ok:true},200,{'Set-Cookie':cookie(token,SESSION_SECONDS)});
}
export async function logout(request,env){
  if(!sameOrigin(request))return json({error:'Origem inválida.'},403);
  const token=tokenFrom(request);if(token)await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await hash(token)).run();
  return json({ok:true},200,{'Set-Cookie':cookie('',0)});
}
