globalThis.RCLM = (() => {
  const NA = 'Não acompanhei / não se aplica';
  const roles = {
    gabinete: {label:'Gabinete', full:'Membro de gabinete', description:'Vereador(a) ou equipe de um gabinete que participou do projeto.', step:'Seu gabinete'},
    camara: {label:'Câmara Municipal', full:'Representante da Câmara Municipal', description:'Equipe de uma Câmara que participou da avaliação institucional.', step:'Sua Câmara'},
    organizacao: {label:'Organização', full:'Membro da organização do projeto', description:'Equipe que planejou ou executou o projeto.', step:'Organização'}
  };
  const sections = [
    {nav:'Seu perfil',title:'Vamos começar pelo seu perfil.',intro:'As perguntas serão adaptadas à sua participação.'},
    {nav:'Experiência',title:'Sua experiência',intro:''},
    {nav:'Metodologia',title:'A metodologia',intro:''},
    {nav:'Desafios',title:'Os desafios',intro:''},
    {nav:'Conclusão',title:'Para as próximas edições',intro:''}
  ];
  const matrix=(id,num,title,rows)=>({id,num,title,type:'matrix',rows:rows.map((text,i)=>({id:`${id}_${i+1}`,text})),hint:'Escolha uma avaliação para cada item que acompanhou.'});
  const text=(id,num,title,placeholder)=>({id,num,title,type:'textarea',placeholder});
  function questions(role,step){
    if(!roles[role])return [];
    const organization=role==='organizacao';
    const target=role==='gabinete'?'o gabinete':'a Câmara';
    if(step===1)return [
      matrix(`projeto_${role}`,'02',organization?'Como você avalia o planejamento e a execução do projeto?':`Como foi a experiência ${role==='gabinete'?'do seu gabinete':'da sua Câmara'} no projeto?`,organization?[
        'Planejamento das etapas','Divisão de tarefas na equipe','Comunicação com gabinetes e Câmaras'
      ]:[
        'Organização das etapas do projeto',
        role==='gabinete'?'Orientações recebidas pelo gabinete':'Orientações recebidas pela Câmara',
        `Utilidade dos resultados para ${target}`
      ]),
      {...text('positivos','03','O que funcionou bem no projeto?','Conte o principal ponto positivo.'),hint:organization?'Pense no que vale manter na organização da próxima edição.':`Pense no que mais ajudou ${target} durante o projeto.`}
    ];
    if(step===2)return [
      matrix(`regras_${role}`,'04',organization?'Como você avalia a metodologia usada no projeto?':`Como você avalia a metodologia aplicada ${role==='gabinete'?'ao gabinete':'à Câmara'}?`,organization?[
        'Clareza dos critérios de avaliação','Facilidade de aplicar a metodologia'
      ]:[
        'Clareza dos critérios de avaliação','Clareza das regras de pontuação'
      ]),
      {id:'ajustes',num:'05',type:'radio',title:organization?'Você mudaria algo na metodologia do projeto?':`Você mudaria alguma regra da avaliação ${role==='gabinete'?'do gabinete':'da Câmara'}?`,options:['Sim','Não tenho ajustes a sugerir','Não tenho elementos para avaliar']},
      {id:'sugestoes',num:'05a',type:'suggestions',title:'O que você mudaria e por quê?',hint:'Não precisa saber o nome ou o código do critério.',showIf:a=>a.ajustes==='Sim',condition:'Somente para quem sugere um ajuste.'}
    ];
    if(step===3)return [
      {id:'desafios',num:'06',type:'checkbox',title:organization?'Quais foram os principais desafios para executar o projeto?':`Quais dificuldades ${target} encontrou no projeto?`,hint:'Escolha até 2 opções.',max:2,options:[
        ...(organization?[
          'Planejar e cumprir o cronograma','Distribuir as tarefas na equipe','Alinhar a aplicação dos critérios','Comunicar as etapas aos participantes','Consolidar e divulgar os resultados'
        ]:[
          'Entender os critérios de avaliação','Reunir as informações solicitadas','Cumprir os prazos','Esclarecer dúvidas com a organização','Entender os resultados recebidos'
        ]),
        'Outro desafio','Não enfrentei dificuldades','Não sei avaliar'
      ],exclusive:['Não enfrentei dificuldades','Não sei avaliar']},
      {...text('desafio_detalhe','06a','Quer explicar essa dificuldade?','Se quiser, conte brevemente o que aconteceu.'),showIf:a=>a.desafios?.some(x=>!['Não enfrentei dificuldades','Não sei avaliar'].includes(x)),condition:'Somente se foi indicado algum desafio.'}
    ];
    if(step===4)return [
      {id:'nps',num:'07',type:'score',title:role==='gabinete'?'De 0 a 10, quanto você recomendaria a participação no projeto a outros gabinetes?':role==='camara'?'De 0 a 10, quanto você recomendaria a participação no projeto a outras Câmaras Municipais?':'De 0 a 10, quanto você recomendaria este projeto a outras instituições?',hint:'Considere a sua experiência na edição de 2026.',low:'Nada provável',high:'Muito provável'},
      text('prioridade','08','Qual é a principal melhoria para a próxima edição?','Indique uma melhoria. Se já comentou, pode pular esta pergunta.')
    ];
    return [];
  }
  return {NA,roles,sections,questions};
})();
