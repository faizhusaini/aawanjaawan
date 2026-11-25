CREATE TABLE posts_with_city_routes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    route TEXT NOT NULL CHECK (route IN ('lko', 'hyd', 'aligarh-hyd', 'hyd-aligarh', 'delhi-hyd', 'hyd-delhi', 'allahabad-hyd', 'hyd-allahabad', 'gorakhpur-hyd', 'hyd-gorakhpur')),
    date TEXT NOT NULL,
    mode TEXT NOT NULL,
    help TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('trip','request')),
    created INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled'))
);
INSERT INTO posts_with_city_routes (id, name, phone, route, date, mode, help, note, type, created, status)
SELECT id, name, phone, route, date, mode, help, note, type, created, status
FROM posts;

DROP TABLE posts;
ALTER TABLE posts_with_city_routes RENAME TO posts;
CREATE INDEX posts_active_date ON posts(status, date);
