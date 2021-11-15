CREATE TABLE streamers (id VARCHAR(20) NOT NULL, nick VARCHAR(30) NOT NULL, avatar_url VARCHAR(100) NOT NULL, is_live BOOLEAN NOT NULL DEFAULT 0, last_live DATETIME, primary key (id));
