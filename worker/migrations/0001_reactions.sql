-- One row per article, visitor and emoji, so each visitor can toggle their own reactions.
-- "page" is the article path without the language prefix (e.g. /posts/guide-media),
-- so all language versions of an article share their counts.
-- "visitor" is a random id kept in the reader's browser; no personal data is stored.
CREATE TABLE reactions (
    page TEXT NOT NULL,
    visitor TEXT NOT NULL,
    reaction TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (page, visitor, reaction)
) WITHOUT ROWID;

-- Running totals, kept up to date by the triggers below, so a page view
-- reads a handful of rows instead of every reaction.
CREATE TABLE reaction_counts (
    page TEXT NOT NULL,
    reaction TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (page, reaction)
) WITHOUT ROWID;

CREATE TRIGGER reactions_added AFTER INSERT ON reactions
BEGIN
    INSERT INTO reaction_counts (page, reaction, count) VALUES (NEW.page, NEW.reaction, 1)
    ON CONFLICT (page, reaction) DO UPDATE SET count = count + 1;
END;

CREATE TRIGGER reactions_removed AFTER DELETE ON reactions
BEGIN
    UPDATE reaction_counts SET count = count - 1
    WHERE page = OLD.page AND reaction = OLD.reaction;
END;

-- Flood protection: recent reaction changes per hashed IP address.
-- Rows older than a minute are deleted on the next request.
CREATE TABLE throttle (
    ip_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX throttle_ip ON throttle (ip_hash);
CREATE INDEX throttle_time ON throttle (created_at);
