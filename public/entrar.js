(()=>{
  const $=id=>document.getElementById(id);
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault();$('login-button').disabled=true;$('login-message').textContent='Verificando acesso…';
    try{
      const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:$('key').value.trim()})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Não foi possível entrar. Tente novamente.');
      $('key').value='';location.assign('/painel.html');
    }catch(error){$('login-message').textContent=error.message||'Verifique sua conexão e tente novamente.';}
    finally{$('login-button').disabled=false;}
  });
  $('generate-key').addEventListener('click',()=>{
    $('generated-key').value=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
    $('generated-box').hidden=false;$('copy-message').textContent='';$('generated-key').focus();
  });
  $('copy-key').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('generated-key').value);$('copy-message').textContent='Chave copiada. Guarde-a em segurança.';}
    catch{$('generated-key').focus();$('generated-key').select();$('copy-message').textContent='Selecione e copie a chave manualmente.';}
  });
})();
