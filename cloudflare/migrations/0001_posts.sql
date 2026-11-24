CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    route TEXT NOT NULL CHECK (route IN ('lko','hyd')),
    date TEXT NOT NULL,
    mode TEXT NOT NULL,
    help TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('trip','request')),
    created INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled'))
);
CREATE INDEX IF NOT EXISTS posts_active_date ON posts(status, date);
