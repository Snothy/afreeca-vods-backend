const db = require('../helpers/database');
const misc = require('./misc');
const modelStreamers = require('../models/streamers');
const { DOMParser } = require('xmldom');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const _this = this;

// translate vod title before adding to db

exports.saveVod = async function saveVod (vod, vodData) {
  let query;
  query = 'INSERT INTO vods VALUES(${title_num}, ${bj_id}, ${thumbnail}, ${date_released}, ${title}, ${station_num}, ${bbs_num}, ${views}, ${duration}) RETURNING title_num;';
  const data1 = await db.run_query_insert(query, vod); // get vod id from return data

  const vod_title_num = vod.title_num;
  query = 'INSERT INTO vods_data(vod_link, vod_title_num) VALUES ($1, $2);';
  for (let i = 0; i < vodData.length; i++) {
    await db.run_query(query, [vodData[i], vod_title_num]);
  }

  return data1;
};

exports.getVodData = async function getVodData (vod_title_num) {
  const query = 'SELECT * FROM vods_data WHERE vod_title_num = $1;';
  const data = await db.run_query(query, [vod_title_num]);

  return data;
};

exports.removeVod = async function removeVod (vod_title_num) {
  let query;
  // remove vods_data
  query = 'DELETE FROM vods_data WHERE vod_title_num = $1;';
  await db.run_query_remove(query, [vod_title_num]);

  // remove vod
  query = 'DELETE FROM vods WHERE title_num = $1;';
  const data = await db.run_query_remove(query, [vod_title_num]);
  return data;
};

exports.getStreamerVods = async function getStreamerVods (bj_id) {
  const query = 'SELECT * FROM vods WHERE bj_id = $1;';
  const data = await db.run_query(query, [bj_id]);
  // console.log(data);
  return data;
};

exports.fetchNewVod = async function fetchNewVod (bj_id, cookie) {
  // set fetching to true
  await modelStreamers.updateFetching(bj_id, true);
  const URL = `https://bjapi.afreecatv.com/api/${bj_id}/vods/all?page=1&per_page=2&orderby=reg_date`;
  let newVod = false;
  let counter = 0;
  let lastVodTitle;

  while (!newVod) {
    await misc.delay(1500); // Wait 1.5sec to not spam too many requests to the server

    let res, body;
    try {
      res = await fetch(URL);
      body = await res.json();
    } catch (err) {
      console.log(err);
    }

    // obtain title_num of last stream
    if (counter === 0 && body.data.length > 0) {
      lastVodTitle = body.data[0].title_no;
    } else if (counter === 0) {
      lastVodTitle = '';
    }

    let currLastVodTitle;
    if (body.data.length > 0) {
      currLastVodTitle = body.data[0].title_no;
    } else {
      currLastVodTitle = '';
    }

    // Compare the two title_nums, if they differ, a new vod has been found
    if (lastVodTitle !== currLastVodTitle) {
      newVod = true;
      _this.createVodObject(bj_id, [body.data[0]], cookie);
      modelStreamers.updateFetching(bj_id, false);
    } else {
      // Every 50 requests, perform some actions & checks
      if (counter % 50 === 0) {
        if (process.env.backend_url) fetch(process.env.backend_url + 'streamers'); // Keep heroku backend web dyno from sleeping
        if (!await modelStreamers.getFetching(bj_id)) return 0; // Check if fetching === true, if not, break loop

        // Check if streamer is Live, if not, set fetching to false & break loop
        if (!await modelStreamers.isLive(bj_id)) {
          modelStreamers.updateFetching(bj_id, false);
          return 0;
        }
      }
      counter++;
    }
  }
  return 1;
};

exports.fetchXVods = async function fetchXVods (bj_id, num_of_vods, cookie) {
  const URL = `https://bjapi.afreecatv.com/api/${bj_id}/vods/all?page=1&per_page=${num_of_vods}&orderby=reg_date`;
  let res, body;
  try {
    res = await fetch(URL);
    body = await res.json();
  } catch (err) {
    console.log(err);
  }

  // Filter vods that are already in the DB
  const streamerVods = await _this.getStreamerVods(bj_id);
  if (streamerVods.length > 0) body.data = body.data.filter(vod => streamerVods.filter(currVod => currVod.title_num === vod.title_no.toString()).length === 0);
  if (body.data.length === 0) return body.data;

  const vods = _this.createVodObject(bj_id, body.data, cookie);
  return vods;
};

exports.createVodObject = async function createVodObject (bj_id, vods, cookie) {
  const result = await Promise.all(
    vods.filter(vod => vod.display.bbs_name === 'Replay').map(vod => {
      return new Promise((resolve) => {
        fetch((`https://stbbs.afreecatv.com/api/video/get_video_info.php?
        nStationNo=${vod.station_no}&nBbsNo=${vod.bbs_no}&nTitleNo=${vod.title_no}&adultView=ADULT_VIEW`), {
          method: 'GET',
          headers: {
            cookie: cookie
          }
        })
          .then(response => {
            return new Promise(async () => {
              const body = await response.text();
              const doc = new DOMParser().parseFromString(body);
              const fileTag = doc.documentElement.getElementsByTagName('file');
              // If no vod files were found
              if (fileTag[0] == null) return;

              // Create array with all vod playlists available
              const vodData = [];
              for (let i = 0; i < fileTag.length; i++) {
                if (fileTag[i].childNodes[0].nodeValue.includes('HIDE')) continue;
                vodData.push(`https://vod-archive-global-cdn-z02.afreecatv.com/v101/hls/vod/${
                  fileTag[i].childNodes[0].nodeValue.split('/').slice(7, 11).join('/')
                }/original/both/playlist.m3u8`);
              }

              // Condense all vod data into an object
              const vodObject = {
                views: parseInt(doc.documentElement.getElementsByTagName('read_cnt')[0].childNodes[0].nodeValue),
                title: doc.documentElement.getElementsByTagName('title')[0].childNodes[0].nodeValue,
                duration: parseInt(doc.documentElement.getElementsByTagName('duration')[0].childNodes[0].nodeValue),
                date_released: doc.documentElement.getElementsByTagName('reg_date')[0].childNodes[0].nodeValue,
                thumbnail: vod.ucc.thumb || '',
                bj_id: bj_id,
                station_num: vod.station_no,
                bbs_num: vod.bbs_no,
                title_num: vod.title_no
              };
              _this.saveVod(vodObject, vodData);
              resolve(vodObject);
            });
          })
          .catch(err => {
            console.log(err);
          });
      });
    })
  );
  return result;
};
