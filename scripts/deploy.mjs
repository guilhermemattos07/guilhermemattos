import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Funciona tanto no Workers Builds quanto em uma máquina autenticada via Wrangler.
const root=fileURLToPath(new URL('../',import.meta.url));
const cli=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
const configPath=new URL('../wrangler.jsonc',import.meta.url);
function run(args,capture=false){
  const result=spawnSync(process.execPath,[cli,...args],{cwd:root,env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},encoding:'utf8',stdio:capture?['ignore','pipe','inherit']:'inherit'});
  if(result.error||result.status!==0)throw new Error(`Falha no comando wrangler ${args.slice(0,3).join(' ')}. Confira o acesso da Cloudflare ao Worker e ao D1.`);
  return result.stdout;
}
function findDatabase(name){
  const databases=JSON.parse(run(['d1','list','--json'],true));
  if(!Array.isArray(databases))throw new Error('A listagem do D1 retornou um formato inesperado.');
  const matches=databases.filter(database=>database.name===name);
  if(matches.length>1)throw new Error('Há mais de um banco com o nome esperado. Confira a configuração.');
  return matches[0];
}
try{
  const config=JSON.parse(readFileSync(configPath,'utf8'));
  const database=config.d1_databases.find(database=>database.binding==='DB');
  if(!database)throw new Error('A configuração precisa do vínculo DB.');
  if(!database.database_id){
    let found=findDatabase(database.database_name);
    if(!found){
      run(['d1','create',database.database_name,'--update-config=false']);
      found=findDatabase(database.database_name);
    }
    if(!found?.uuid)throw new Error('Não foi possível identificar o banco criado.');
    database.database_id=found.uuid;
    writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
  }
  // A nova aplicação só é publicada depois que o esquema está pronto.
  run(['d1','migrations','apply','DB','--remote']);
  run(['deploy']);
}catch(error){console.error(error.message);process.exitCode=1;}
