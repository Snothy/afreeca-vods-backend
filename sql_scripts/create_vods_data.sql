CREATE TABLE vods_data (id INT NOT NULL AUTO_INCREMENT, vod_title_num VARCHAR(100), vod_link VARCHAR(400), PRIMARY KEY (id), FOREIGN KEY (vod_title_num) REFERENCES vods (title_num));
