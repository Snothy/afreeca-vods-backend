const db = require('../helpers/database');
const modelVods = require('../models/vods');
const request = require('request');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
// const fetch = require("node-fetch");
const _this = this;

exports.getById = async function getById (bj_id) {
  const query = 'SELECT * FROM streamers WHERE id = $1;';
  const data = await db.run_query(query, [bj_id]);

  return data;
};

/*
exports.getByUsername = async function getByUsername (bj_username) {
    const query = 'SELECT * FROM streamers WHERE username = ?;';
    const data = await db.run_query(query, bj_username);

    return data;
}

exports.getIdByUsername = async function getIdByUsername (bj_username) {
    const query = 'SELECT id FROM streamers WHERE username = ?;';
    const data = await db.run_query(query,bj_username);

    return data[0].id;
}

exports.getUsernameById = async function getUsernameById (bj_id) {
    //inefficient implementation, since afreeca considers the username the ID
    const query = 'SELECT username FROM streamers WHERE id = ?;';
    const data = await db.run_query(query,bj_id);

    return data[0].username;
}
*/
exports.getAll = async function getAll () {
  const query = 'SELECT * FROM streamers ORDER BY id ASC;';
  const data = await db.run_query(query);
  return data;
};

exports.updateStreamer = async function updateStreamer (bj) {
  // console.log(bj);
  // ${nick}, ${avatar_url}, ${is_live}, ${last_live}
  const query = 'UPDATE streamers SET nick = ${nick}, avatar_url = ${avatar_url}, is_live = ${is_live}, last_live = ${last_live}  WHERE ID = ${id} RETURNING nick;';
  const data = await db.run_query_insert(query, bj);
  return data;
};

exports.getData = async function getData (bj_id) {
  // get avatar and last_stream data
  let res, body, avatar, last_stream, nick;
  const avatarUrl = `https://bjapi.afreecatv.com/api/${bj_id}/station`;
  // console.log(avatarUrl);
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

    // Converting to last_stream datetime to GMT+2 time is a pain.
    // cba doing the conversion for vods (misc->V2 function (reg_date variable))]
    // would be better to get the timezone directly from the system
    // and not manually changing the multiplier on getTimezoneOffset :))))))))

    // console.log(last_stream);
    // last_stream = new Date(Date.parse(last_stream));
    const bits = last_stream.split(/\D/);
    last_stream = new Date(bits[0], --bits[1], bits[2], bits[3], bits[4]);
    // console.log(last_stream);

    // last_stream.setTime( last_stream.getTime() + last_stream.getTimezoneOffset()*460*1000 );

    // const a = last_stream.toLocaleString()
    // console.log(a);
    // last_stream.setTime( last_stream.getTime() + last_stream.getTimezoneOffset()*90*1000 );
    // last_stream = misc.convertTimezone(last_stream, 'EET')
  } catch (err) {
    console.error(err);
  }

  return { avatar: avatar, last_live: last_stream, nick: nick };
};

exports.isLive = async function isLive (bj_id) {
  let res, body, info;
  const liveApiUrl = 'http://live.afreeca.com/api/get_broad_state_list.php?uid=';
  try {
    // console.log(liveApiUrl+bj_id);
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
    // console.log(body);
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
    // console.log(info);
  } catch (err) {
    console.error(err);
  }

  if (CODE !== 1) {
    return { live_url: '', title: TITLE, code: CODE };
  }
  // Get the server url in which the playlist is stored
  url = `https://livestream-manager.afreecatv.com/broad_stream_assign.html?return_type=gcp_cdn&broad_key=${BNO}-common-original-hls&use_cors=true&cors_origin_url=play.afreecatv.com`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Cookie: cookie
      }
    });
    const body = await res.json();
    LIVEURL = body.view_url;
    // console.log(info);
  } catch (err) {
    console.error(err);
  }
  const result = LIVEURL + '?aid=' + AID;
  // Fetch 3 times to avoid the "pre_loading" segments, which seem to prevent
  // the player from loading further .TS (video) segments

  for (let i = 0; i < 3; i++) {
    try {
      await fetch(result, {
        method: 'GET',
        headers: {
        }
      });
    } catch (err) {
      console.error(err);
    }
  }

  return { live_url: result, title: TITLE, bno: BNO, code: CODE, chat: CHAT, auth: AUTH, ftk: FTK, chatno: CHATNO };//, playlist: PLAYLIST};
};

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

  for (let i = 0; i < data.length; i++) {
    const info = liveList[i].CHANNEL.BROAD_INFOS[0].list[0]; // stream data
    const stateValues = new Map();
    stateValues.set(-1, false);
    stateValues.set(1, true);
    const isLive = stateValues.get(info.nState);

    let last_stream = last_streamList[i].DATA.broad_start;
    // console.log(last_stream);
    const nick = last_streamList[i].DATA.user_nick;
    const bits = last_stream.split(/\D/);
    last_stream = new Date(bits[0], --bits[1], bits[2], bits[3], bits[4]);
    // console.log(last_stream);
    // last_stream.setTime( last_stream.getTime() + last_stream.getTimezoneOffset()*460*1000 );

    data[i].is_live = isLive;
    data[i].last_live = last_stream;
    data[i].nick = nick;
    _this.updateStreamer(data[i]);

    // get live information
    if (data[i].is_live) {
      data[i].bno = info.nBroadNo;
      data[i].title = info.szBroadTitle;
      data[i].streamImg = info.szThumImg;
      data[i].views = info.nCurrentView;
    }
  }
  const fetching = await _this.getAllFetching();

  return { streamers: data, fetching: fetching };
};

exports.addStreamer = async function addStreamer (bj_id) {
  // bj object (data to add new bj)
  // call getData for username

  // fetch for avatar, recent stream, islive default = 0,
  const bjData = await _this.getData(bj_id); // avatar, last_live
  const bj = { id: bj_id, nick: bjData.nick, avatar_url: bjData.avatar, is_live: false, last_live: bjData.last_live };
  // const bj = [bj_id, bjData.nick, bjData.avatar, false, bjData.last_live];

  // need bj object
  const query = 'INSERT INTO streamers VALUES(${id}, ${nick}, ${avatar_url}, ${is_live}, ${last_live}) RETURNING id;';
  const data = await db.run_query_insert(query, bj);

  // set fetching
  await _this.addFetching(bj_id);

  return data;
};

exports.removeStreamer = async function (bj_id) {
  // remove vods_data, remove vods, remove bj
  let query, data, title_num;
  data = await modelVods.getStreamerVods(bj_id);
  for (let i = 0; i < data.length; i++) {
    // remove vods_data
    title_num = data[i].title_num;
    // console.log(title_num);
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

exports.getAllFetching = async function getAllFetching () {
  const query = 'SELECT * FROM fetching ORDER BY bj_id ASC;';
  const data = await db.run_query(query);
  return data;
};

exports.getFetching = async function getFetching (bj_id) {
  const query = 'SELECT * FROM fetching WHERE bj_id = $1;';
  const data = await db.run_query(query, [bj_id]);
  return data[0].fetching;
};

exports.addFetching = async function addFetching (bj_id) {
  const query = 'INSERT INTO fetching VALUES($1, $2) RETURNING bj_id;';
  const data = await db.run_query_insert(query, [bj_id, false]);
  return data;
};

exports.removeFetching = async function removeFetching (bj_id) {
  const query = 'DELETE FROM fetching WHERE bj_id = $1';
  const data = await db.run_query_remove(query, [bj_id]);
  return data;
};

exports.initFetching = async function initFetching () {
  // when the api starts, set all fetching to false
  const streamers = await _this.getAll();
  for (let i = 0; i < streamers.length; i++) {
    const query = 'UPDATE fetching SET fetching=$1 WHERE bj_id=$2;';
    const values = [false, streamers[i].id];
    await db.run_query(query, values);
  }
};

exports.updateFetching = async function updateFetching (bj_id, fetchingBool) {
  const query = 'UPDATE fetching SET fetching=$1 WHERE bj_id=$2 RETURNING bj_id;';
  const values = [fetchingBool, bj_id];
  const result = await db.run_query_insert(query, values);
  return result;
};

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
