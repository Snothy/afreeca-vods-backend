/**
 * Module representing all functionalities to interact with the streamers table in the DB.
 * @module models/streamers
 * @author Petar Drumev
 * @see routes/streamers for the route that requires these methods
 */

const db = require('../helpers/database');
const modelVods = require('../models/vods');
const request = require('request');
const moment = require('moment-timezone');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const _this = this;

/**
 * Get data for a specific streamer
 * @param {string} bj_id Streamer's unique ID. BJ stands for broadcast jockey
 * @returns {Array<object>} A one element array. The element is an object containing all streamer data
 */
exports.getById = async function getById (bj_id) {
  const query = 'SELECT * FROM streamers WHERE id = $1;';
  const data = await db.run_query(query, [bj_id]);
  return data;
};

/**
 * Get data for all streamers in the database
 * @returns {Array<object>} An array of n length. Each element represents a streamer object, containing that streamers data
 */
exports.getAll = async function getAll () {
  const query = 'SELECT * FROM streamers ORDER BY id ASC;';
  const data = await db.run_query(query);
  return data;
};

/**
 * Update details for a specific streamer in the database
 * @param {object} bj A streamer object with any updated properties
 * @returns {number} Number representing rows affected.
 */
exports.updateStreamer = async function updateStreamer (bj) {
  const query = 'UPDATE streamers SET nick = ${nick}, avatar_url = ${avatar_url}, is_live = ${is_live}, last_live = ${last_live}  WHERE ID = ${id} RETURNING nick;';
  const data = await db.run_query_insert(query, bj);
  return data;
};

/**
 * Get the latest avatar, stream date & nickname information for a specific streamer
 * @param {string} bj_id Streamer's unique ID.
 * @returns {object} Object containing latest avatar, stream date & nickname
 */
exports.getData = async function getData (bj_id) {
  // get avatar and last_stream data
  let res, body, avatar, last_stream, nick;
  const avatarUrl = `https://bjapi.afreecatv.com/api/${bj_id}/station`;
  const lastStreamUrl = `https://st.afreecatv.com/api/get_station_status.php?szBjId=${bj_id}`;

  try {
    res = await fetch(avatarUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36'
      }
    });
    body = await res.json();
    avatar = body.profile_image;
    nick = body.station.user_nick;
    // console.log(nick)

    res = await fetch(lastStreamUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36'
      }
    });
    body = await res.json();
    last_stream = body.DATA.broad_start;
    // Convert GMT+9 or Asia/Seoul AfreecaTV date to UTC
    const format = 'YYYY-MM-DD hh:mm:ss';
    const tz = 'Asia/Seoul';
    const momentDate = moment.tz(last_stream, format, tz);
    last_stream = momentDate.utc().toDate();
  } catch (err) {
    console.error(err);
  }

  return { avatar: avatar, last_live: last_stream, nick: nick };
};

/**
 * Get the Live (is streaming) status for a specific streamer.
 * @param {string} bj_id Streamer's unique ID.
 * @returns {boolean} Whether the streamer is currently Live or not.
 */
exports.isLive = async function isLive (bj_id) {
  let res, body, info;
  const liveApiUrl = 'http://live.afreeca.com/api/get_broad_state_list.php?uid=';
  try {
    res = await fetch((liveApiUrl + bj_id), {
      method: 'GET',
      headers: {
        Referer: 'http://live.afreeca.com/api/get_broad_state_list.php?uid=' + bj_id
      }
    });
    body = await res.json();
    info = body.CHANNEL.BROAD_INFOS[0].list[0]; // stream data
    const stateValues = new Map();
    stateValues.set(-1, false);
    stateValues.set(1, true);
    return stateValues.get(info.nState);
  } catch (err) {
    console.error(err);
  }
};

/**
 * Fetch all necessary information to launch a livestream & connect to the streams chat.
 * @param {string} bj_id Streamer's unique ID.
 * @param {string} cookie Cookie in order to authenticate with some services when obtaining the information.
 * Some streams require a login to be viewed.
 * @returns {object} All information necessary to launch the livestream and establish a connection to
 * the chat through websockets.
 */
exports.getLive = async function getLive (bj_id, cookie) {
  let BNO, TITLE, AID, LIVEURL, CODE, CHAT, AUTH, FTK, CHATNO;//, PLAYLIST;
  let url = `https://live.afreecatv.com/afreeca/player_live_api.php?bjid=${bj_id}`;
  // get BNO(livestream id) and TITLE
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams({
        bid: bj_id,
        type: 'live',
        quality: 'original',
        player_type: 'html5',
        mode: 'landing'

      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie
      }
    });
    const body = await res.json();
    if (body.CHANNEL.RESULT !== 1) return { live: false };
    BNO = body.CHANNEL.BNO;
    TITLE = body.CHANNEL.TITLE;
    CODE = body.CHANNEL.RESULT;
    FTK = body.CHANNEL.FTK;
    CHATNO = body.CHANNEL.CHATNO;
    if (cookie !== '') {
      AUTH = body.CHANNEL.TK;
    } else {
      AUTH = '';
    }
    const port = parseInt(body.CHANNEL.CHPT) + 1;
    CHAT = 'wss://' + body.CHANNEL.CHDOMAIN + ':' + port + `/Websocket/${bj_id}`;
  } catch (err) {
    console.error(err);
  }

  // get AID (unique identifier for the livestream m3u8 playlist on their servers)
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams({
        bid: bj_id,
        bno: BNO,
        type: 'aid',
        pwd: '',
        player_type: 'html5',
        stream_type: 'common',
        quality: 'original',
        mode: 'landing',
        from_api: 0

      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie
      }
    });
    const body = await res.json();
    AID = body.CHANNEL.AID;
  } catch (err) {
    console.error(err);
  }

  if (CODE !== 1) {
    return { live: false };
  }
  // Get the server url in which the playlist is stored
  url = `https://livestream-manager.afreecatv.com/broad_stream_assign.html?return_type=gcp_cdn&broad_key=
  ${BNO}-common-original-hls&use_cors=true&cors_origin_url=play.afreecatv.com`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Cookie: cookie
      }
    });
    const body = await res.json();
    LIVEURL = body.view_url;
  } catch (err) {
    console.error(err);
  }
  const result = LIVEURL + '?aid=' + AID;
  // Fetch 3 times to avoid the "pre_loading" segments, which seem to prevent
  // the player from loading further .TS (video) segments
  // not awaiting this is fine
  for (let i = 0; i < 3; i++) {
    try {
      fetch(result, {
        method: 'GET',
        headers: {
        }
      });
    } catch (err) {
      console.error(err);
    }
  }

  return { live: true, live_url: result, title: TITLE, bno: BNO, chat: CHAT, auth: AUTH, ftk: FTK, chatno: CHATNO };//, playlist: PLAYLIST};
};

/**
 * Get all Live streamers for a specific page. Each page can contain
 * up to 60 streams. Sorted by viewcount.
 * @param {number} page Which page to fetch
 * @returns {Array<object>} Array containing all streams & their corresponding data
 */
exports.getBrowse = async function getBrowse (page) {
  let result;
  const url = `https://live.afreecatv.com/api/main_broad_list_api.php?selectType=action&selectValue=all&orderType=view_cnt&pageNo=${page}&lang=en_US`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {

      }
    });
    result = await res.json();
    result = result.broad;
  } catch (err) {
    console.error(err);
  }
  return result;
};

/**
 * Update properties for all streamers in the database
 * @returns {object} The streamers property contains all streamers with their updated data.
 *
 * Streamers who are currently Live have additional data appended to their object.
 *
 * The fetching property is a list of all streamers & whether there's a fetch active for them.
 * A fetch being active means the program is listening for a new vods to add to the db. For
 * example if the streamer is live and you want the new vod to be added. This feature was
 * added simply for fun & to learn how to handle long pending requests.
 */
exports.refreshAllFast = async function refreshAllFast () {
  // only updates whether theyre live
  const data = await _this.getAll();
  const liveApiUrl = 'http://live.afreeca.com/api/get_broad_state_list.php?uid=';

  // get if currently live
  const liveList = await Promise.all(
    data.map(bj => {
      return new Promise((resolve) => {
        try {
          fetch((liveApiUrl + bj.id), {
            method: 'GET',
            headers: {
              Referer: liveApiUrl + bj.id
            }
          })
            .then(response => {
              return new Promise(() => {
                resolve(response.json());
              });
            });
        } catch (err) {
          console.error(err);
        }
      });
    })
  );

  // get last stream start date and nick
  const last_streamList = await Promise.all(
    data.map(bj => {
      return new Promise((resolve) => {
        try {
          fetch((`https://st.afreecatv.com/api/get_station_status.php?szBjId=${bj.id}`), {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36'
            }
          })
            .then(response => {
              return new Promise(() => {
                resolve(response.json());
              });
            });
        } catch (err) {
          console.error(err);
        }
      });
    })
  );

  const stateValues = new Map();
  stateValues.set(-1, false);
  stateValues.set(1, true);
  const fetching = await _this.getAllFetching();
  for (let i = 0; i < data.length; i++) {
    const info = liveList[i].CHANNEL.BROAD_INFOS[0].list[0]; // stream data
    const isLive = stateValues.get(info.nState);
    const nick = last_streamList[i].DATA.user_nick;
    let last_stream = last_streamList[i].DATA.broad_start;
    // Convert GMT+9 or Asia/Seoul AfreecaTV date to UTC
    const format = 'YYYY-MM-DD hh:mm:ss';
    const tz = 'Asia/Seoul';
    const momentDate = moment.tz(last_stream, format, tz);
    last_stream = momentDate.utc().toDate();

    data[i].is_live = isLive;
    data[i].last_live = last_stream;
    data[i].nick = nick;
    data[i].fetching = fetching[i].fetching;
    _this.updateStreamer(data[i]);

    // get live information
    if (data[i].is_live) {
      data[i].bno = info.nBroadNo;
      data[i].title = info.szBroadTitle;
      data[i].streamImg = info.szThumImg;
      data[i].views = info.nCurrentView;
    }
  }

  return { streamers: data };
};

/**
 * Add a new streamer to the database.
 * @param {string} bj_id Streamer's unique ID.
 * @returns {number} Number representing rows affected in the database.
 */
exports.addStreamer = async function addStreamer (bj_id) {
  const bjData = await _this.getData(bj_id); // avatar, last_live
  const bj = { id: bj_id, nick: bjData.nick, avatar_url: bjData.avatar, is_live: false, last_live: bjData.last_live };
  const query = 'INSERT INTO streamers VALUES(${id}, ${nick}, ${avatar_url}, ${is_live}, ${last_live}) RETURNING id;';
  const data = await db.run_query_insert(query, bj);
  await _this.addFetching(bj_id);

  return data;
};

/**
 * Remove a streamer from the database
 * @param {string} bj_id Streamer's unique ID.
 * @returns {number} Number representing rows affected in the database.
 */
exports.removeStreamer = async function (bj_id) {
  let query, data, title_num;
  data = await modelVods.getStreamerVods(bj_id);
  for (let i = 0; i < data.length; i++) {
    // remove vods_data
    title_num = data[i].title_num;
    query = 'DELETE FROM vods_data WHERE vod_title_num = $1;';
    await db.run_query(query, [title_num]);
    // remove vod
    query = 'DELETE FROM vods WHERE title_num = $1;';
    await db.run_query(query, [title_num]);
  }
  // remove fetching
  await _this.removeFetching(bj_id);
  // remove streamer
  query = 'DELETE FROM streamers WHERE id = $1';
  data = await db.run_query_remove(query, [bj_id]);
  return data;
};

/**
 * Get a list of all streamers' fetch status.
 * @returns {Array<object>} Each element is an object containing a streamer and their fetch status.
 * Fetching is properly explained in the refreshAllFast method :D.
 */
exports.getAllFetching = async function getAllFetching () {
  const query = 'SELECT * FROM fetching ORDER BY bj_id ASC;';
  const data = await db.run_query(query);
  return data;
};

/**
 * Get a specific streamer's fetch status
 * @param {string} bj_id Streamer's unique ID.
 * @returns an object containing a streamer and their fetch status.
 * Fetching is properly explained in the refreshAllFast method :D
 */
exports.getFetching = async function getFetching (bj_id) {
  const query = 'SELECT * FROM fetching WHERE bj_id = $1;';
  const data = await db.run_query(query, [bj_id]);
  return data[0].fetching;
};

/**
 * Insert a new streamer and their fetching status into the database
 * @param {string} bj_id Streamer's unique ID.
 * @returns {number} Number of rows affected by the query.
 */
exports.addFetching = async function addFetching (bj_id) {
  const query = 'INSERT INTO fetching VALUES($1, $2) RETURNING bj_id;';
  const data = await db.run_query_insert(query, [bj_id, false]);
  return data;
};

/**
 * Remove a streamer and their fetching status from the database
 * @param {string} bj_id Streamer's unique ID.
 * @returns {number} Number of rows affected by the query
 */
exports.removeFetching = async function removeFetching (bj_id) {
  const query = 'DELETE FROM fetching WHERE bj_id = $1';
  const data = await db.run_query_remove(query, [bj_id]);
  return data;
};

/**
 * Sets the fetching status of all streamers in the database to false.
 *
 * This method is used when starting the server.
 */
exports.initFetching = async function initFetching () {
  // when the api starts, set all fetching to false
  const streamers = await _this.getAll();
  for (let i = 0; i < streamers.length; i++) {
    const query = 'UPDATE fetching SET fetching=$1 WHERE bj_id=$2;';
    const values = [false, streamers[i].id];
    await db.run_query(query, values);
  }
};

/**
 * Update the fetching status of a specific streamer
 * @param {string} bj_id Streamer's unique ID.
 * @param {boolean} fetchingBool Boolean representing the fetching status
 * @returns {number} Number of rows affected by the query
 */
exports.updateFetching = async function updateFetching (bj_id, fetchingBool) {
  const query = 'UPDATE fetching SET fetching=$1 WHERE bj_id=$2 RETURNING bj_id;';
  const values = [fetchingBool, bj_id];
  const result = await db.run_query_insert(query, values);
  return result;
};

/**
 *  Use login credentials to authenticate with AfreecaTV.
 * @param {*} username Username
 * @param {*} password Password
 * @returns {object} The entire response object from the fetch. This contains information such as
 * whether the login was successful & the cookies that come with a successful authentication.
 */
exports.login = async function (username, password) {
  const options = {
    method: 'POST',
    url: 'https://login.afreecatv.com/app/LoginAction.php',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36'
    },
    form: {
      isLoginRetain: 'Y',
      isSaveId: 'false',
      szAction: '',
      szPassword: password,
      szScriptVar: 'oLoginRet',
      szType: 'json',
      szUid: username,
      szWork: 'login'
    }
  };

  const result = await new Promise((resolve) => {
    request(options, function (error, response) {
      if (error) throw new Error(error);
      resolve(response);
    });
  });
  return result;
};
