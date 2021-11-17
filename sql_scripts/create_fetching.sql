CREATE TABLE fetching (bj_id VARCHAR(20), fetching BOOLEAN NOT NULL DEFAULT false, FOREIGN KEY (bj_id) REFERENCES streamers (id), primary key (bj_id));
