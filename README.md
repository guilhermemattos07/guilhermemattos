# Feedback · Reconhecimento das Câmaras 2026

Versão preparada para GitHub + Cloudflare Workers + D1. Mantém o visual do formulário, as logos, o preenchimento por público, o painel de respostas, o CSV e o gráfico NPS. As perguntas foram simplificadas para gabinetes participantes, Câmaras avaliadas e equipe organizadora.

**O pacote está pronto para publicação, mas baixá-lo ou enviá-lo ao GitHub não publica o site.** A base da Cloudflare começa vazia. Respostas existentes no site anterior não foram copiadas.

## 1. Colocar os arquivos no GitHub

O repositório escolhido é [guilhermemattos07/guilhermemattos](https://github.com/guilhermemattos07/guilhermemattos). Para importar este pacote manualmente, extraia o ZIP e envie seu conteúdo para a raiz do repositório. `package.json`, `wrangler.jsonc`, `public/`, `src/` e `migrations/` precisam aparecer nessa raiz. Não envie o ZIP fechado nem crie uma pasta extra envolvendo os arquivos.

O repositório contém somente código e imagens: respostas e credenciais ficam fora dele.

## 2. Conectar à Cloudflare

Na Cloudflare, abra **Workers & Pages → Create application → Import a repository**. Conecte sua conta GitHub e autorize apenas o repositório deste projeto.

Use estas configurações:

| Campo | Valor |
| --- | --- |
| Worker / Project name | `rclm-feedback-2026` |
| Production branch | `main` |
| Root directory | raiz do repositório (`/`) |
| Build command | `npm test && npm run build` |
| Deploy command | `npm run deploy` |
| Node.js | 22.13 ou superior; recomendado 24 |

Desative builds de outras branches para esta primeira publicação. Os comandos acima preparam a aplicação, criam ou reutilizam o banco D1 `rclm-feedback-2026`, aplicam seu esquema e publicam o Worker. As atualizações posteriores preservam as respostas.

**Permissão necessária para o banco:** o token automático do Workers Builds pode não incluir D1. Em **My Profile → API Tokens**, edite o token usado por este Worker e acrescente **Account → D1 → Edit**, limitado à sua conta. Depois, execute **Retry build**. O segredo permanece na Cloudflare; não o coloque no código, no GitHub ou no chat. Sem essa permissão, a publicação para antes de alterar a aplicação.

## 3. Configurar o painel

Depois de a Cloudflare informar que a publicação terminou:

1. Abra o endereço criado e acrescente `/entrar.html`.
2. Expanda **Sou responsável pelo site. Como configuro o primeiro acesso?** e gere sua chave. Guarde-a em um gerenciador de senhas.
3. Na Cloudflare, abra o Worker → **Settings → Variables and Secrets → Add**. Escolha **Secret**, nome `ADMIN_KEY`, e cole a chave como valor. Salve e publique essa alteração. Este é um segredo de execução do Worker, não uma variável do build.
4. Entre em `/entrar.html` com a chave. O painel abrirá em `/painel.html`.
5. No painel, abra **Privacidade e LGPD**. A organização deve confirmar responsável, e-mail de atendimento, prazo de guarda e o texto apresentado aos participantes. Salvar essas informações mantém a coleta pausada.
6. Revise o formulário. Quando estiver pronto, use **Abrir coleta**.

A chave serve somente à administração. Os participantes respondem sem criar conta. Para revogar as sessões administrativas, gere uma nova chave e substitua `ADMIN_KEY`. Não compartilhe a chave com os participantes.

## Endereço gratuito

A Cloudflare fornece um endereço no formato `rclm-feedback-2026.SEUSUBDOMINIO.workers.dev`. O subdomínio da conta pode ser configurado em Workers & Pages. Se `guilhermemattos07` estiver disponível e for escolhido por você, o formato será `rclm-feedback-2026.guilhermemattos07.workers.dev`. Este pacote não reserva o nome.

O projeto usa recursos que têm planos gratuitos. Em novembro de 2026, Workers Free inclui 100 mil requisições dinâmicas por dia; D1 Free inclui 5 milhões de linhas lidas por dia, 100 mil escritas por dia e 5 GB por conta. Aplicam-se também limites de CPU e de builds. O código não ativa planos pagos; acompanhe o consumo no painel da Cloudflare.

## Páginas e dados

| Caminho | Uso |
| --- | --- |
| `/formulario/index.html` | Formulário dos participantes |
| `/formulario/index.html?preview=1` | Testar o formulário sem registrar respostas |
| `/entrar.html` | Entrar na administração |
| `/painel.html` | Respostas reais, filtros, análises e exportações |
| `/painel.html?demo=1` | Demonstração identificada, somente com dados fictícios |

O formulário começa com a coleta pausada. Nome, vínculo, função, município e e-mail são opcionais. Perfil e consentimento são necessários para enviar. As opções de município são Cariacica, Serra, Vila Velha e Vitória. As respostas são gravadas no D1; não dependem do armazenamento do navegador.

As sessões administrativas duram até oito horas, usam cookie HttpOnly e Secure, e o banco guarda somente o hash do token. Tentativas de entrada são limitadas. O comprovante permite ao participante excluir sua resposta. O prazo de guarda é aplicado no servidor; respostas vencidas são removidas da base ativa no próximo acesso que consulta respostas ou configuração. Exportações e backups exigem gestão da organização. O aviso e esses controles apoiam a adequação à LGPD; não substituem a revisão e as responsabilidades da organização.

O painel calcula NPS como `% de promotores (9–10) − % de detratores (0–6)`, desconsiderando respostas em branco ou “não sei avaliar”. As notas de 1 a 5 são analisadas separadamente. A demonstração não entra nos resultados reais.

## Desenvolvimento local

Requer Node.js 22.13+ e npm. Execute `npm ci`, depois `npx wrangler d1 migrations apply DB --local` e `npm run dev`. Para testar a administração, copie `.dev.vars.example` para `.dev.vars` e preencha `ADMIN_KEY` com uma chave aleatória de 64 caracteres hexadecimais. `.dev.vars` está excluído do Git. Nunca use respostas reais nos testes.

`npm test` verifica autorização, sessões, validação, consentimento, gravação, exclusão, retenção, NPS e exportação. `npm run build` gera o roteiro, as regras do servidor e valida o pacote com Wrangler sem publicar. `npm run deploy` publica na conta Cloudflare autenticada; use-o somente para a publicação desejada.

## Documentação oficial

- [Publicação pela Cloudflare com Git](https://developers.cloudflare.com/workers/get-started/dashboard/)
- [Workers Builds: comandos e permissões](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Endereço workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Limites de Workers](https://developers.cloudflare.com/workers/platform/pricing/)
- [Limites de D1](https://developers.cloudflare.com/d1/platform/pricing/)
- [Limites de builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)
