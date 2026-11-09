const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../public/formulario/questions.js'),'utf8'));
const {questions,roles,sections}=globalThis.RCLM;
const lines=['FORMULÁRIO DE FEEDBACK','Reconhecimento das Câmaras Legislativas Municipais 2026','Versão revisada — perguntas sobre o projeto por público','',
'ABERTURA',
'O Reconhecimento das Câmaras Legislativas Municipais 2026 foi concluído e os resultados estão finalizados. Queremos ouvir os gabinetes, as Câmaras Municipais e os membros da organização sobre os pontos positivos, desafios e sugestões para aprimorar futuras edições. Este formulário não altera os resultados de 2026.',
'A identificação é opcional. Responda apenas sobre o que acompanhou. A prévia navegável ainda não coleta respostas.','',
'PERFIL — OBRIGATÓRIO','01. Qual é o seu vínculo com o projeto?',...Object.values(roles).map(r=>'- '+r.label+': '+r.description),
'Escolha única. Se houver mais de um vínculo, escolha a perspectiva principal desta resposta.',
'A seleção adapta automaticamente a linguagem, os critérios disponíveis e o bloco específico.',
'',
'IDENTIFICAÇÃO OPCIONAL',
'Município: Cariacica; Serra; Vila Velha; Vitória; prefiro não informar.',
'Nome; gabinete / Câmara / instituição; função ou cargo; e-mail. Todos os campos são opcionais.',''];
function add(q){lines.push(`${q.num}. ${q.title}`,'Opcional.');if(q.hint)lines.push(q.hint);if(q.condition)lines.push('Lógica: '+q.condition);if(q.rows){lines.push(...q.rows.map(x=>'- '+x.text),'Escala: 1 muito ruim; 2 ruim; 3 regular; 4 bom; 5 muito bom; não acompanhei / não se aplica.');}else if(q.options)lines.push(...q.options.map(x=>'- '+x));else if(q.type==='score')lines.push('Opções: 0 a 10 e não sei avaliar.');else if(q.type==='suggestions')lines.push('Mudança sugerida e motivo em um campo aberto. Critério e tipo de ajuste são opcionais e ficam recolhidos.','Tipos: revisar redação; ajustar peso/pontuação; ajustar evidências; incluir critério; retirar critério; reorganizar/evitar sobreposição; ajustar orientações ou procedimentos; outro.','Catálogo filtrado pelo perfil: gabinete vê critérios parlamentares; Câmara vê critérios institucionais; organização pode escolher os dois.');else lines.push('Resposta aberta.');lines.push('');}
for(const role of Object.keys(roles)){lines.push('='.repeat(60),`PERCURSO COMPLETO: ${roles[role].full.toUpperCase()}`,'='.repeat(60),'');for(const step of [1,2,3,4]){lines.push(sections[step].title.toUpperCase(),'');questions(role,step).forEach(add);}}
lines.push('ORIENTAÇÕES PARA CONSOLIDAÇÃO','Separar os resultados por público. Nas médias, excluir respostas em branco e não aplicáveis, mostrando o número de respostas válidas. NPS: percentual de promotores (9–10) menos percentual de detratores (0–6), excluindo brancos e não sei avaliar. Notas 7–8 são neutras. Organizar sugestões por diagnóstico, critério, mudança e justificativa.','O consentimento é necessário ao envio real. Antes de abrir a coleta, confirmar no painel o responsável, o canal de privacidade e o prazo de guarda.','',
'BASE DOCUMENTAL','RCLM - Nota Metodológica 2026.pdf; Nota Metodológica 2026 - RCLM.pdf; Reconhecimento das Câmaras Legislativas Municipais 2026 (1).pptx.','Modelo de feedback e materiais anteriores do Fórum fornecidos na conversa: referências de temas, sem atribuir à edição de 2026 os fatos de 2024.');
fs.writeFileSync(path.join(__dirname,'../public/formulario/roteiro_feedback_2026.txt'),'\ufeff'+lines.join('\n'));
console.log('Roteiro exportado com os três percursos completos.');
