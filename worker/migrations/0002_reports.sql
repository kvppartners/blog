-- Flood protection for Visa map problem reports: one row per report sent, by hashed
-- IP address. Rows older than a day are deleted on the next report.
CREATE TABLE report_log (
    ip_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX report_log_ip ON report_log (ip_hash);
CREATE INDEX report_log_time ON report_log (created_at);
