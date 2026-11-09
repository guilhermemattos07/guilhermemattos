import {createApi} from './api.js';
import {authenticate,login,logout,json} from './auth.js';

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname,method=request.method;
    try{
      let response;
      if(path==='/api/session'&&method==='POST')response=await login(request,env);
      else if(path==='/api/session'&&method==='DELETE')response=await logout(request,env);
      else if(path.startsWith('/api/')){
        const api=createApi(request,env);
        const routes={
          'GET /api/config':api.getConfig,
          'POST /api/responses':api.submitResponse,
          'POST /api/withdraw':api.withdrawResponse,
          'GET /api/admin/responses':api.listResponses,
          'PATCH /api/admin/responses':api.reviewResponse,
          'DELETE /api/admin/responses':api.deleteResponse,
          'PATCH /api/admin/settings':api.updateSettings
        };
        const handler=routes[method+' '+path];response=handler?await handler(request):json({error:'Rota não encontrada.'},404);
      }else{
        if(['/painel','/painel.html','/painel/'].includes(path)&&url.searchParams.get('demo')!=='1'){
          const auth=await authenticate(request,env);
          if(auth.error)return new Response(null,{status:302,headers:{Location:'/entrar.html','Cache-Control':'no-store'}});
        }
        response=await env.ASSETS.fetch(request);
      }
      const result=new Response(response.body,response);
      result.headers.set('X-Content-Type-Options','nosniff');
      result.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
      result.headers.set('X-Frame-Options','SAMEORIGIN');
      if(path.startsWith('/painel')||path.startsWith('/api/'))result.headers.set('Cache-Control','no-store');
      return result;
    }catch{return json({error:'O serviço está indisponível. Tente novamente em alguns instantes.'},503);}
  }
};
