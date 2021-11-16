const db = require('../helpers/database');
const misc = require('./misc');
const modelVods = require('../models/vods');
var request = require('request');
//fetch = require('cross-fetch');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
//const fetch = require('fetch');
//const fetch = require("node-fetch");
var _this = this;

exports.getById = async function getById (bj_id) {
    const query = 'SELECT * FROM streamers WHERE id = $1;';
    const data = await db.run_query(query, [bj_id]);
    
    return data;
}

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
exports.getAll = async function getAll() {
    const query = 'SELECT * FROM streamers;';
    const data = await db.run_query(query);

    return data;
}

exports.updateStreamer = async function updateStreamer(bj) {
    //console.log(bj);
    //${nick}, ${avatar_url}, ${is_live}, ${last_live}
    const query = 'UPDATE streamers SET nick = ${nick}, avatar_url = ${avatar_url}, is_live = ${is_live}, last_live = ${last_live}  WHERE ID = ${id} RETURNING id;';
    const data = await db.run_query_insert(query, bj);
    return data;
}

exports.getData = async function getData(bj_id) {
    //get avatar and last_stream data
    var res, body, avatar, last_stream, nick
    const avatarUrl = `https://bjapi.afreecatv.com/api/${bj_id}/station`;
    //console.log(avatarUrl);
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
        //console.log(nick)

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

        //console.log(last_stream);
        //last_stream = new Date(Date.parse(last_stream));
        var bits = last_stream.split(/\D/);
        last_stream = new Date(bits[0], --bits[1], bits[2], bits[3], bits[4]);
        //console.log(last_stream);
        last_stream.setTime( last_stream.getTime() + last_stream.getTimezoneOffset()*120*1000 );
        //const a = last_stream.toLocaleString()
        //console.log(a);
        //last_stream.setTime( last_stream.getTime() + last_stream.getTimezoneOffset()*60*1000 );
        //last_stream = misc.convertTimezone(last_stream, 'EET')

    } catch(err) {
        console.error(err);
    }

    return {avatar: avatar, last_live: last_stream, nick: nick};

}

exports.isLive =  async function isLive (bj_id) {
    var bj = await _this.getById(bj_id);
    var res, body, info, isLive;
    const liveApiUrl = 'http://live.afreeca.com/api/get_broad_state_list.php?uid=';
    try {
        //console.log(liveApiUrl+bj_id);
        res = await fetch( (liveApiUrl + bj_id), {
            method: 'GET',
            headers: {
                'Referer': 'http://live.afreeca.com/api/get_broad_state_list.php?uid=' + bj_id
            }
        });
        body = await res.json();
        info = body.CHANNEL.BROAD_INFOS[0].list[0]; //stream data
        //console.log(info);
    } catch (err) {
        console.error(err);
    }

    const stateValues = new Map(); //just felt like implementing a map lol
    stateValues.set(-1, false);
    stateValues.set(1, true);
    isLive = stateValues.get(info.nState);


    //fetch new avatar/recent stream dates
    const data = await _this.getData(bj_id);
    //console.log(data);
    bj[0].avatar_url = data.avatar;
    bj[0].last_live = data.last_live;
    bj[0].nick = data.nick
    //console.log(bj[0]);


    //maybe only return isLive instead of bj?
    if(!!bj[0].is_live !== isLive) {
        bj[0].is_live = isLive;
        _this.updateStreamer(bj[0]);
        return bj;
    } else {
        _this.updateStreamer(bj[0]);
        return bj;
    }
}

exports.refreshAll = async function refreshAll() {
    const data = await _this.getAll();
    //console.log(data);
    for (i=0; i<data.length; i++) {
        const bj = await _this.isLive(data[i].id);
        data[i] = bj[0];
    }
    //console.log(data);

    return data;
}

exports.refreshAllFast = async function refreshAllFast() {
    //only updates whether theyre live
    const data = await _this.getAll();
    const liveApiUrl = 'http://live.afreeca.com/api/get_broad_state_list.php?uid=';
    
    //get if currently live
    const liveList = await Promise.all(
        data.map(bj => {
            return new Promise((resolve) => {
                try {
                    fetch( (liveApiUrl + bj.id), {
                        method: 'GET',
                        headers: {
                            'Referer': liveApiUrl + bj.id
                        }
                    })
                    .then(response => {
                        return new Promise(() => {
                            resolve(response.json());
                        })
                    })
                } catch (err) {
                    console.error(err);
                }
            })
        })
    );
    
    //get last stream start date and nick
    const last_streamList = await Promise.all(
        data.map(bj => {
            return new Promise((resolve) => {
                try {
                    fetch( (`https://st.afreecatv.com/api/get_station_status.php?szBjId=${bj.id}`), {
                        method: 'GET',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36'
                        }
                    })
                    .then(response => {
                        return new Promise(() => {
                            resolve(response.json());
                        })
                    })
                } catch (err) {
                    console.error(err);
                }
            })
        })
    );

    for(let i=0; i<data.length; i++) {
        info = liveList[i].CHANNEL.BROAD_INFOS[0].list[0]; //stream data
        const stateValues = new Map();
        stateValues.set(-1, false);
        stateValues.set(1, true);
        isLive = stateValues.get(info.nState);

        let last_stream = last_streamList[i].DATA.broad_start; 
        const nick = last_streamList[i].DATA.user_nick;
        var bits = last_stream.split(/\D/);
        last_stream = new Date(bits[0], --bits[1], bits[2], bits[3], bits[4]);
        last_stream.setTime( last_stream.getTime() + last_stream.getTimezoneOffset()*120*1000 );

        data[i].is_live = isLive;
        data[i].last_live = last_stream;
        data[i].nick = nick;
        _this.updateStreamer(data[i]);
    }

    return data;
    
}

exports.addStreamer = async function addStreamer(bj_id) {
    //bj object (data to add new bj)
    //call getData for username

    //fetch for avatar, recent stream, islive default = 0, 
    const bjData = await _this.getData(bj_id); //avatar, last_live
    const bj = {id: bj_id, nick: bjData.nick, avatar_url: bjData.avatar, is_live: false, last_live: bjData.last_live};
    //const bj = [bj_id, bjData.nick, bjData.avatar, false, bjData.last_live];

    //need bj object
    const query = 'INSERT INTO streamers VALUES(${id}, ${nick}, ${avatar_url}, ${is_live}, ${last_live}) RETURNING id;';
    const data = await db.run_query_insert(query, bj);
    //console.log(data.insertId);
    return data;
}

exports.removeStreamer = async function (bj_id) {
    //remove vods_data, remove vods, remove bj
    let query, data, vodsData, id, title_num
    data = await modelVods.getStreamerVods(bj_id);
    for(let i=0; i<data.length; i++) {

        //remove vods_data
        title_num = data[i].title_num;
        //console.log(title_num);
        query = 'DELETE FROM vods_data WHERE vod_title_num = $1;';
        await db.run_query(query, [title_num]);

        //remove vod
        query = 'DELETE FROM vods WHERE title_num = $1;';
        await db.run_query(query, [title_num]);
    }
    //remove streamer
    query = 'DELETE FROM streamers WHERE id = $1';
    data = await db.run_query_remove(query, [bj_id]);
    
    return data;
}

exports.parseCookies = function parseCookies(str) {
    let rx = RegExp("/([^;=\s]*)=([^;]*)/g");
    console.log(str);
    console.log(rx.exec(str));
    let obj = { };
    for ( let m ; m = rx.exec(str) ; )
      obj[ m[1] ] = decodeURIComponent( m[2] );
    return obj;
}

exports.login = async function (username, password) {
    let arr = [];
    var options = {
        'method': 'POST',
        'url': 'https://login.afreecatv.com/app/LoginAction.php',
        'headers': {
          'sec-ch-ua': '"Chromium";v="94", "Google Chrome";v="94", ";Not A Brand";v="99"',
          'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'sec-ch-ua-mobile': '?0',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36',
          'sec-ch-ua-platform': '"Windows"',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
          'Cookie': 'AbroadChk=OK; AbroadVod=OK'
        },
        form: {
          'isLoginRetain': 'Y',
          'isSaveId': 'false',
          'szAction': '',
          'szPassword': password,
          'szScriptVar': 'oLoginRet',
          'szType': 'json',
          'szUid': username,
          'szWork': 'login'
        }
      };

      //this took me 4 hours to figure out :' )
      let result = await new Promise((resolve) => {
            request(options,   function (error, response) {
            if (error) throw new Error(error);
            //console.log(JSON.parse(response.body));
            //const result = JSON.parse(response.body).RESULT;
            //console.log(result);
            //let arr = [];
            //arr.push(result);
            //arr.push(response);
            //console.log(response.body);
    
            /*
            if(JSON.parse(response.body).RESULT === 1) {
                arr.push(true);
            } else {
                arr.push(false);
            }
            arr.push(response.headers['set-cookie']);
            return arr;
            */
            resolve(response);
          });
      })
      

      //console.log(result.body);
      return result;
}


//get streamer status (is_live)
//   on route 
//  - if streamer is live, perform vod fetch
//  - if not live, check if live again in 5-10 minutes
//  - upon successful vods fetch, update stream (is_live -> 0), add add vod..

//add new streamer (add_streamer)

//fetch_new_vod ??



//add to vods - title, bbsno, cno, streamid?