CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE responses (id TEXT PRIMARY KEY NOT NULL,submitted_at TEXT NOT NULL,role TEXT NOT NULL,municipality TEXT NOT NULL DEFAULT '',identity_json TEXT NOT NULL DEFAULT '{}',answers_json TEXT NOT NULL DEFAULT '{}',suggestions_json TEXT NOT NULL DEFAULT '[]',form_version TEXT NOT NULL DEFAULT '2026-v3',review_status TEXT NOT NULL DEFAULT 'pendente',admin_note TEXT NOT NULL DEFAULT '',consent_json TEXT NOT NULL DEFAULT '{}',expires_at TEXT NOT NULL DEFAULT '',withdrawal_hash TEXT NOT NULL DEFAULT '');
CREATE INDEX responses_submitted_idx ON responses(submitted_at);
CREATE INDEX responses_role_idx ON responses(role);
CREATE INDEX responses_expiry_idx ON responses(expires_at);
CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY NOT NULL,key_hash TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE TABLE login_attempts (bucket TEXT PRIMARY KEY NOT NULL,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL);
