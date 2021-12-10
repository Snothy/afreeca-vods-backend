const db = require('../helpers/database');
const misc = require('./misc');
const modelStreamers = require('../models/streamers');
const { DOMParser } = require('xmldom');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const _this = this;

// translate vod title before adding to db

/**
 * Save a vod object to the database.
 * @param {object} vod An object containing information about the vod.
 * @param {Array<string>} vodData An array of m3u8 playlists that make up the conents of the vod.
 * @returns {number} Number of affected rows in the database.
 */
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

/**
 * Get all m3u8 playlists that make up the content of a specific vod.
 * @param {number} vod_title_num A vods unique identifier.
 * @returns {Array<string>} An array of m3u8 playlists that make up the conents of the vod.
 */
exports.getVodData = async function getVodData (vod_title_num) {
  const query = 'SELECT * FROM vods_data WHERE vod_title_num = $1;';
  const data = await db.run_query(query, [vod_title_num]);

  return data;
};

/**
 * Remove a vod and its associated playlist data from the database.
 * @param {number} vod_title_num A vods unique identifier.
 * @returns {number} Rows affected in the database.
 */
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

/**
 * Get all vods tied to a specific streamer.
 * @param {string} bj_id A streamer's unique identifies
 * @returns {Array<object>} An array containing all of their vods
 */
exports.getStreamerVods = async function getStreamerVods (bj_id) {
  const query = 'SELECT * FROM vods WHERE bj_id = $1;';
  const data = await db.run_query(query, [bj_id]);
  // console.log(data);
  return data;
};

/**
 * This method was developed mostly for testing & learning purposes.
 *
 * The response will take a long time.
 *
 * Only used for streamers who are currently Live.
 *
 * It works by listening for new vods by saving the ID of the last available VOD for
 * a specific streamer and then making requests until a new vod is found.
 *
 * It will periodically check whether the streamer is still Live, and if no
 * vod was found for whatever reason, the fetching will stop.
 * @param {string} bj_id A streamers unique identifier.
 * @param {string} cookie A cookie to identify the user making the request.
 * The data for some vods can only be obtained if you are logged in.
 * @returns {number} 1 on success and 0 on fail or error. The vod is saved
 * to the database on success.
 */
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
      _this.createVodObject(bj_id, [body.data[0]], cookie, true);
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

/**
 * Fetch a number of vods for a specific streamer.
 *
 * This will only return vods that are not already saved in the database.
 * @param {string} bj_id A streamers unique identifier
 * @param {number} num_of_vods The number of vods you want to attempt to fetch
 * @param {string} cookie A cookie to identify the user making the request.
 * The data for some vods can only be obtained if you are logged in.
 * @returns {Array<object>} An array of vod objects, which also contain all m3u8 playlist data.
 */
exports.fetchXVodsDb = async function fetchXVods (bj_id, num_of_vods, cookie) {
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

  const vods = _this.createVodObject(bj_id, body.data, cookie, true);
  return vods;
};

/**
 * Fetch a number of vods for a specific streamer.
 * @param {string} bj_id A streamers unique identifier
 * @param {number} num_of_vods The number of vods you want to attempt to fetch
 * @param {string} cookie A cookie to identify the user making the request.
 * The data for some vods can only be obtained if you are logged in.
 * @returns {Array<object>} An array of vod objects, which also contain all m3u8 playlist data.
 */
exports.fetchXVods = async function fetchXVods (bj_id, num_of_vods, cookie) {
  const URL = `https://bjapi.afreecatv.com/api/${bj_id}/vods/all?page=1&per_page=${num_of_vods}&orderby=reg_date`;
  let res, body;
  try {
    res = await fetch(URL);
    body = await res.json();
  } catch (err) {
    console.log(err);
  }

  if (body.data.length === 0) return body.data;

  const vods = _this.createVodObject(bj_id, body.data, cookie, false);
  return vods;
};

// Only fetches 'Replay' vods, so full vods, not clips.
/**
 * Given an array of vod objects, this method will retrieve their
 * corresponding m3u8 playlist data.
 *
 * The playlist data is what makes up the content of the vod.
 *
 * @param {string} bj_id A streamers unique identifier.
 * @param {Array<object>} vods An array of vod objects for which you want to fetch the playlist data.
 * @param {string} cookie A cookie to identify the user making the request.
 * The data for some vods can only be obtained if you are logged in.
 * @param {boolean} addToDb Whether you want to add the vods & their playlist data to the database
 * @returns {Array<object>} An array of vods, which contain their playlist data.
 */
exports.createVodObject = async function createVodObject (bj_id, vods, cookie, addToDb) {
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
              if (fileTag[0] == null) {
                resolve(0); // Resolving with a 0, not sure how to resolve a Promise without returning anything
                return;
              }

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
              if (addToDb) {
                _this.saveVod(vodObject, vodData);
              }
              vodObject.playlistData = vodData;
              resolve(vodObject);
            });
          })
          .catch(err => {
            console.log(err);
          });
      });
    })
  );
  return result.filter(vod => vod !== 0);
};
