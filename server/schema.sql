CREATE TABLE IF NOT EXISTS sources (
 id TEXT PRIMARY KEY NOT NULL, url TEXT NOT NULL UNIQUE, name TEXT NOT NULL, color TEXT NOT NULL,
 method TEXT NOT NULL DEFAULT 'Discovering', feed_url TEXT, status TEXT NOT NULL DEFAULT 'pending',
 error TEXT, last_checked TEXT, last_success TEXT, paused INTEGER NOT NULL DEFAULT 0, removed_at TEXT
);
CREATE TABLE IF NOT EXISTS articles (
 id TEXT PRIMARY KEY NOT NULL, source_id TEXT NOT NULL, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', author TEXT, published TEXT,
 discovered TEXT NOT NULL, media TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '[]',
 saved INTEGER NOT NULL DEFAULT 0, read INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '',
 capture TEXT NOT NULL DEFAULT 'metadata'
);
CREATE INDEX IF NOT EXISTS articles_source ON articles(source_id);
CREATE INDEX IF NOT EXISTS articles_date ON articles(published,discovered);
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS collector_jobs (
 id TEXT PRIMARY KEY NOT NULL, owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 started TEXT, finished TEXT, status TEXT NOT NULL DEFAULT 'idle', result TEXT
);
INSERT OR IGNORE INTO collector_jobs(id) VALUES('collector');
PRAGMA user_version=1;
