import rules from './feedback-rules.json' with {type:'json'};
const plain = (v)=>!!v && typeof v === 'object' && !Array.isArray(v);
const str = (v, max)=>typeof v === 'string' && v.length <= max;
export function validateFeedback(data) {
    if (!plain(data) || ![
        'gabinete',
        'camara',
        'organizacao'
    ].includes(data.role)) throw Error('Selecione um perfil válido.');
    if (!str(data.submissionId, 36) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submissionId)) throw Error('Identificador de envio inválido.');
    if (!plain(data.identity) || !plain(data.answers) || !Array.isArray(data.suggestions)) throw Error('Respostas inválidas.');
    if (data.consent !== true || !str(data.privacyVersion, 80) || !data.privacyVersion) throw Error('É necessário autorizar o uso dos dados após ler o aviso de privacidade.');
    if (typeof data.withdrawalToken !== 'string' || !/^[0-9a-f]{64}$/.test(data.withdrawalToken)) throw Error('Código de exclusão inválido.');
    const identity = {};
    for (const [k, v] of Object.entries(data.identity)){
        if (![
            'nome',
            'vinculo',
            'funcao',
            'email',
            'municipio'
        ].includes(k) || !str(v, 250)) throw Error('Confira os campos de identificação.');
        identity[k] = v.trim();
    }
    if (identity.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) throw Error('Confira o e-mail ou deixe o campo em branco.');
    if (identity.municipio && ![
        'Cariacica',
        'Serra',
        'Vila Velha',
        'Vitória'
    ].includes(identity.municipio)) throw Error('Município inválido.');
    const roleRules = rules[data.role];
    const answers = {};
    for (const [k, v] of Object.entries(data.answers)){
        const rule = Object.prototype.hasOwnProperty.call(roleRules,k) ? roleRules[k] : null;
        if (!rule) throw Error('Há respostas incompatíveis com o perfil selecionado.');
        if (rule.type === 'text') {
            if (!str(v, 3000)) throw Error('Limite de 3.000 caracteres por resposta aberta.');
            answers[k] = v.trim();
        } else if (rule.type === 'multiple') {
            if (!Array.isArray(v) || v.length > (rule.max || 20) || new Set(v).size !== v.length || v.some((x)=>!rule.options.includes(x))) throw Error('Confira as opções selecionadas.');
            if (rule.exclusive?.some((x)=>v.includes(x)) && v.length > 1) throw Error('Uma opção exclusiva foi combinada com outras respostas.');
            answers[k] = v;
        } else {
            if (!rule.options.includes(v)) throw Error('Nota ou opção inválida.');
            answers[k] = v;
        }
    }
    if (answers.evento !== 'Sim') delete answers.evento_avaliacao_1;
    if (![
        'Sim, houve mudanças implementadas',
        'Há mudanças em andamento ou planejadas'
    ].includes(answers.mudancas)) delete answers.mudancas_detalhe;
    if (answers.gabinete_dependencia !== 'Sim') delete answers.gabinete_dependencia_detalhe;
    if (!(answers.desafios || []).some((x)=>![
            'Não enfrentei dificuldades',
            'Não sei avaliar'
        ].includes(x))) delete answers.desafio_detalhe;
    const suggestions = [];
    if (answers.ajustes === 'Sim') {
        if (data.suggestions.length > 10) throw Error('Registre até 10 propostas por resposta.');
        for (const row of data.suggestions){
            if (!plain(row) || Object.keys(row).some((k)=>![
                    'target',
                    'code',
                    'type',
                    'proposal',
                    'reason'
                ].includes(k))) throw Error('Proposta de ajuste inválida.');
            if (Object.values(row).some((v)=>!str(v, 3000))) throw Error('Limite de 3.000 caracteres por campo de proposta.');
            const allowed = data.role === 'organizacao' ? [
                'gabinete',
                'camara',
                'processo',
                'novo'
            ] : [
                data.role,
                'processo',
                'novo'
            ];
            if (!allowed.includes(row.target)) throw Error('O ajuste não corresponde ao perfil selecionado.');
            if (row.code && !rules.criteria[row.target]?.includes(row.code)) throw Error('Código de critério inválido.');
            const cleaned = {};
            for (const k of [
                'target',
                'code',
                'type',
                'proposal',
                'reason'
            ])cleaned[k] = (row[k] || '').trim();
            if (cleaned.proposal || cleaned.reason) suggestions.push(cleaned);
        }
    }
    return {
        submissionId: data.submissionId,
        role: data.role,
        identity,
        answers,
        suggestions,
        privacyVersion: data.privacyVersion,
        withdrawalToken: data.withdrawalToken
    };
}
