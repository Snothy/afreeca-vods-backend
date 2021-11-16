CREATE TABLE streamers (id VARCHAR(20) NOT NULL, nick VARCHAR(30) NOT NULL, avatar_url text NOT NULL, is_live BOOLEAN NOT NULL DEFAULT false, last_live date, primary key (id));
