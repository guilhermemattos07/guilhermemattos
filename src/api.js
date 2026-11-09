import {validateFeedback} from './validate-feedback.js';
import {authenticate} from './auth.js';
export function createApi(request,env){
function db() {
    if (!env.DB) throw new Error('Armazenamento indisponível.');
    return env.DB;
}
function json(data, status = 200) {
    return Response.json(data, {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        }
    });
}
async function privacyConfig() {
    const row = await db().prepare('SELECT value FROM settings WHERE key = ?').bind('privacy_config').first();
    if (!row) return null;
    return JSON.parse(row.value);
}
async function collectionOpen() {
    const row = await db().prepare('SELECT value FROM settings WHERE key = ?').bind('collection_open').first();
    return row?.value === 'true' && !!(await privacyConfig())?.reviewedAt;
}
async function purgeExpired() {
    await db().prepare("DELETE FROM responses WHERE expires_at <> '' AND expires_at <= ?").bind(new Date().toISOString()).run();
}
async function hashToken(token) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), (b)=>b.toString(16).padStart(2, '0')).join('');
}
function sameOrigin(request) {
    return request.headers.get('origin') === new URL(request.url).origin;
}
async function body(request) {
    if (!request.headers.get('content-type')?.includes('application/json')) throw Error('Formato de envio inválido.');
    if (Number(request.headers.get('content-length')) > 100000) throw Error('O conteúdo excede o tamanho permitido.');
    const reader = request.body?.getReader();
    if (!reader) throw Error('Conteúdo ausente.');
    const chunks = [];
    let size = 0;
    while(true){
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 100000) {
            await reader.cancel();
            throw Error('O conteúdo excede o tamanho permitido.');
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks){
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
}

const admin=()=>authenticate(request,env);
async function getConfig() {
    try {
        await purgeExpired();
        return json({
            collectionOpen: await collectionOpen(),
            privacy: await privacyConfig(),
            version: '2026-v3'
        });
    } catch  {
        return json({
            collectionOpen: false,
            error: 'Não foi possível consultar a coleta.'
        }, 503);
    }
}

async function submitResponse(request) {
    if (!sameOrigin(request)) return json({
        error: 'Origem de envio inválida.'
    }, 403);
    let payload;
    try {
        payload = validateFeedback(await body(request));
    } catch (e) {
        return json({
            error: e instanceof Error ? e.message : 'Confira as respostas.'
        }, 400);
    }
    try {
        await purgeExpired();
        const existing = await db().prepare('SELECT withdrawal_hash FROM responses WHERE id = ?').bind(payload.submissionId).first();
        const hash = await hashToken(payload.withdrawalToken);
        if (existing) {
            if (existing.withdrawal_hash !== hash) return json({
                error: 'Identificador já utilizado.'
            }, 409);
            return json({
                ok: true,
                receipt: payload.submissionId,
                repeated: true
            });
        }
        if (!await collectionOpen()) return json({
            error: 'A coleta está pausada. Suas respostas não foram enviadas.'
        }, 409);
        const privacy = await privacyConfig();
        if (!privacy || privacy.version !== payload.privacyVersion) return json({
            error: 'O aviso de privacidade foi atualizado. Volte a abrir o formulário e leia a versão atual antes de enviar.'
        }, 409);
        const now = new Date();
        const expiry = new Date(now.getTime() + privacy.retentionDays * 86400000).toISOString();
        const consent = {
            accepted: true,
            acceptedAt: now.toISOString(),
            notice: privacy,
            purpose: 'Feedback da edição de 2026 e aprimoramento de futuras edições.'
        };
        const result = await db().prepare('INSERT OR IGNORE INTO responses (id, submitted_at, role, municipality, identity_json, answers_json, suggestions_json, form_version, consent_json, expires_at, withdrawal_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(payload.submissionId, now.toISOString(), payload.role, payload.identity.municipio || '', JSON.stringify(payload.identity), JSON.stringify(payload.answers), JSON.stringify(payload.suggestions), '2026-v3', JSON.stringify(consent), expiry, hash).run();
        if (!result.meta.changes) {
            const row = await db().prepare('SELECT withdrawal_hash FROM responses WHERE id = ?').bind(payload.submissionId).first();
            if (row?.withdrawal_hash !== hash) return json({
                error: 'Identificador já utilizado.'
            }, 409);
        }
        return json({
            ok: true,
            receipt: payload.submissionId
        }, 201);
    } catch  {
        return json({
            error: 'Não foi possível salvar. Tente novamente; suas respostas continuam nesta página.'
        }, 503);
    }
}

async function withdrawResponse(request) {
    if (!sameOrigin(request)) return json({
        error: 'Origem inválida.'
    }, 403);
    let data;
    try {
        data = await body(request);
    } catch  {
        return json({
            error: 'Confira o comprovante e o código.'
        }, 400);
    }
    if (typeof data.id !== 'string' || data.id.length !== 36 || typeof data.token !== 'string' || !/^[0-9a-f]{64}$/.test(data.token)) return json({
        error: 'Confira o comprovante e o código de exclusão.'
    }, 400);
    try {
        const result = await db().prepare('DELETE FROM responses WHERE id = ? AND withdrawal_hash = ?').bind(data.id, await hashToken(data.token)).run();
        if (!result.meta.changes) return json({
            error: 'Comprovante ou código incorreto, ou resposta já excluída.'
        }, 404);
        return json({
            ok: true
        });
    } catch  {
        return json({
            error: 'Não foi possível excluir agora. Tente novamente.'
        }, 503);
    }
}

async function updateSettings(request) {
    try {
        const auth = await admin();
        if (auth.error) return auth.error;
        if (!sameOrigin(request)) return json({
            error: 'Origem inválida.'
        }, 403);
        const data = await body(request);
        const now = new Date().toISOString();
        if (data.privacy) {
            const p = data.privacy;
            if (data.confirmed !== true || typeof p.controller !== 'string' || !p.controller.trim() || p.controller.length > 200 || typeof p.contact !== 'string' || p.contact.length > 250 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contact) || ![
                90,
                180,
                365
            ].includes(p.retentionDays)) return json({
                error: 'Informe o responsável, um e-mail válido, o prazo de guarda e confirme a revisão.'
            }, 400);
            const privacy = {
                controller: p.controller.trim(),
                contact: p.contact.trim(),
                retentionDays: p.retentionDays,
                reviewedAt: now,
                version: `2026-${crypto.randomUUID()}`
            };
            await db().batch([
                db().prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('privacy_config', JSON.stringify(privacy), now),
                db().prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('collection_open', 'false', now)
            ]);
            return json({
                ok: true,
                privacy,
                collectionOpen: false
            });
        }
        if (typeof data.collectionOpen !== 'boolean') return json({
            error: 'Configuração inválida.'
        }, 400);
        if (data.collectionOpen && !(await privacyConfig())?.reviewedAt) return json({
            error: 'Configure o aviso de privacidade antes de abrir a coleta.'
        }, 409);
        await db().prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('collection_open', String(data.collectionOpen), now).run();
        return json({
            ok: true,
            collectionOpen: data.collectionOpen
        });
    } catch  {
        return json({
            error: 'Não foi possível alterar a configuração.'
        }, 503);
    }
}

async function listResponses(request) {
    try {
        const auth = await admin();
        if (auth.error) return auth.error;
        await purgeExpired();
        const u = new URL(request.url);
        const offset = Math.max(0, Math.min(100000, Number(u.searchParams.get('offset')) || 0));
        const rows = await db().prepare('SELECT * FROM responses ORDER BY submitted_at DESC, id DESC LIMIT 500 OFFSET ?').bind(offset).all();
        const count = await db().prepare('SELECT COUNT(*) AS total FROM responses').first();
        const list = rows.results.map((row)=>({
                id: row.id,
                submittedAt: row.submitted_at,
                role: row.role,
                formVersion: row.form_version,
                municipality: row.municipality,
                identity: JSON.parse(row.identity_json),
                answers: JSON.parse(row.answers_json),
                suggestions: JSON.parse(row.suggestions_json),
                reviewStatus: row.review_status,
                adminNote: row.admin_note,
                consent: JSON.parse(row.consent_json),
                expiresAt: row.expires_at
            }));
        return json({
            rows: list,
            total: count?.total || 0,
            nextOffset: offset + list.length < (count?.total || 0) ? offset + list.length : null,
            collectionOpen: await collectionOpen(),
            administrator: auth.user?.displayName,
            privacy: await privacyConfig()
        });
    } catch  {
        return json({
            error: 'Não foi possível carregar as respostas.'
        }, 503);
    }
}
async function reviewResponse(request) {
    try {
        const auth = await admin();
        if (auth.error) return auth.error;
        if (!sameOrigin(request)) return json({
            error: 'Origem inválida.'
        }, 403);
        const data = await body(request);
        if (typeof data.id !== 'string' || ![
            'pendente',
            'analisada'
        ].includes(data.reviewStatus) || typeof data.adminNote !== 'string' || data.adminNote.length > 4000) return json({
            error: 'Dados de análise inválidos.'
        }, 400);
        const r = await db().prepare('UPDATE responses SET review_status=?,admin_note=? WHERE id=?').bind(data.reviewStatus, data.adminNote, data.id).run();
        if (!r.meta.changes) return json({
            error: 'Resposta não encontrada.'
        }, 404);
        return json({
            ok: true
        });
    } catch  {
        return json({
            error: 'Não foi possível salvar sua análise.'
        }, 503);
    }
}
async function deleteResponse(request) {
    try {
        const auth = await admin();
        if (auth.error) return auth.error;
        if (!sameOrigin(request)) return json({
            error: 'Origem inválida.'
        }, 403);
        const data = await body(request);
        if (typeof data.id !== 'string' || data.id.length !== 36 || data.confirm !== true) return json({
            error: 'Confirme a exclusão da resposta.'
        }, 400);
        const r = await db().prepare('DELETE FROM responses WHERE id=?').bind(data.id).run();
        if (!r.meta.changes) return json({
            error: 'Resposta não encontrada.'
        }, 404);
        return json({
            ok: true
        });
    } catch  {
        return json({
            error: 'Não foi possível excluir.'
        }, 503);
    }
}

return {getConfig,submitResponse,withdrawResponse,updateSettings,listResponses,reviewResponse,deleteResponse};
}
