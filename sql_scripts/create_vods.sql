CREATE TABLE vods (title_num VARCHAR(100) NOT NULL, bj_id VARCHAR(20), thumbnail VARCHAR(300), date_released date, title VARCHAR(100) NOT NULL, station_num VARCHAR(100) NOT NULL, bbs_num VARCHAR(100) NOT NULL, views INT, duration INT, PRIMARY KEY (title_num), FOREIGN KEY (bj_id) REFERENCES streamers (id));


