const db = require('../helpers/database');
const misc = require('./misc');
const modelStreamers = require('../models/streamers');
const convert = require('html-to-json-data');
const { group, text, number, href, src, uniq } = require('html-to-json-data/definitions');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
var _this = this;

//translate vod title before adding to db

exports.saveVod =  async function saveVod (vod, vodData) {
    var query, data1, data2;
    query = 'INSERT INTO vods VALUES(${title_num}, ${bj_id}, ${thumbnail}, ${date_released}, ${title}, ${station_num}, ${bbs_num}, ${views}, ${duration}) RETURNING title_num;';
    data1 = await db.run_query_insert(query, vod); //get vod id from return data

    const vod_title_num = vod.title_num;
    query = 'INSERT INTO vods_data(vod_link, vod_title_num) VALUES ($1, $2);'
    for (let i=0; i<vodData.length; i++) {
        data2 = await db.run_query(query, [vodData[i], vod_title_num]);
    }

    return data1;
}

exports.getVodData =  async function getVodData (vod_title_num) {
    const query = 'SELECT * FROM vods_data WHERE vod_title_num = $1;';
    const data = await db.run_query(query, [vod_title_num]);

    return data;
}


exports.getStreamerVods =  async function getStreamerVods (bj_id) {
    const query = 'SELECT * FROM vods WHERE bj_id = $1;';
    const data = await db.run_query(query, [bj_id]);
    //console.log(data);
    return data;
}


exports.fetchNewVod = async function fetchNewVod (bj_id, cookie) {
    //set fetching to true
    await modelStreamers.updateFetching(bj_id, true);

    const URL = 'https://bjapi.afreecatv.com/api/' + bj_id + '/vods/all?page=1&per_page=2&orderby=reg_date';
    var newVod = false;
    var counter = 0;
    var lastVodTitle;
    var newVodData, titleNum, stationNum, bbsNum;

    while(!newVod) {
        await misc.delay(1500) //wait a second or two to not spam too many requests to the server

        //keep server alive (falls asleep after 30min on heroku) every 100 
        if(counter%100 === 0) {
          fetch(process.env.backend_url+'streamers');
        }

        var res, body
        try {
            res = await fetch(URL);
            body = await res.json();
        } catch(err) {
            console.log(err);
        }

        //HANDLE CASE OF NO VODS CURRENTLY AVAILABLE (body.data === [] (arr.length of 0))
        //obtain title id of last stream (so the code knows when a new one appears)
        if(counter === 0 && body.data.length>0) {
            lastVodTitle = body.data[0].title_no;
        } else if (counter === 0) {
          lastVodTitle = '';
        }

        var currLastVodTitle;
        if(body.data.length>0) {
          currLastVodTitle= body.data[0].title_no;
        } else {
          currLastVodTitle = '';
        }

        if(lastVodTitle !== currLastVodTitle) {
            newVod = true;
            newVodData = body.data[0]; //latest video data
            titleNum = newVodData.title_no; //latest video URL id
            stationNum = newVodData.station_no;
            bbsNum = newVodData.bbs_no;

        } else {
            //console.log('a'); //for checking how often it makes a request
            counter++;
        }
    }

    //call function to create video link from thumbnail data
    var thumbnailUrl = newVodData.ucc.thumb;
    //console.log(thumbnailUrl);
    if(thumbnailUrl === null) {
        thumbnailUrl = '';
    }

    const vodUrlV2 = await misc.createNewVodLinkV2(cookie, stationNum, bbsNum, titleNum); //get title, reg_date
    //writeVodsToFile(bj_id, thumbnailUrl, 'vodUrl', vodUrlV2.data); //vodUrl (backup url just slows down the program, might add later)
    //console.log(vodUrlV2);

    //const vodUrl = misc.createNewVodLink(thumbnailUrl); //old version (backup url)
    //console.log('\n' + vodUrl);

    const{data, ...vod} = vodUrlV2; //omit the data object
    vod.bj_id = bj_id;
    vod.thumbnail = thumbnailUrl;
    const saveVod = _this.saveVod(vod, data);

    //set fetching back to false
    await modelStreamers.updateFetching(bj_id, false);
    return 1;
}

exports.fetchXVods = async function fetchXVods (bj_id, num_of_vods, cookie) {
    const URL = `https://bjapi.afreecatv.com/api/${bj_id}/vods/all?page=1&per_page=${num_of_vods}&orderby=reg_date`;
    var newVodData, titleNum, stationNum, bbsNum, res, body;

    try {
        res = await fetch(URL);
        body = await res.json();
    } catch(err) {
        console.log(err);
    }
    let vods = [];


    const filteredVods = body.data.filter(vod => vod.display.bbs_name === 'Replay')
    //get all vod data
    const vodDataList = await Promise.all(
        filteredVods.map(vod => {
            return new Promise((resolve) => {
                try {
                    stationNum = vod.station_no;
                    bbsNum = vod.bbs_no
                    titleNum = vod.title_no;
                    fetch( (`https://stbbs.afreecatv.com/api/video/get_video_info.php?nStationNo=${stationNum}&nBbsNo=${bbsNum}&nTitleNo=${titleNum}&adultView=ADULT_VIEW`), {
                        method: 'GET',
                        headers: {
                            cookie: cookie
                        }
                    })
                    .then(response => {
                        return new Promise(() => {
                            resolve(response.text());
                        })
                    })
                } catch (err) {
                    console.error(err);
                }
            })
        })
    );

    for(let u=0; u<vodDataList.length; u++) {
        body = vodDataList[u];
        let emptyArr = [];
        const vodData = misc.searchString(body, 'vod-archive', emptyArr);
        
        if(!vodData.length) {
            continue;
        }

        let extraData = convert(body, {
            views: number('read_cnt'),
            title: text('title'),
            duration: number('duration'),
            date_released: text('reg_date')  //file: text('file')
        });
        
        extraData.title = extraData.title.slice(9, -3);
        for (let i=0; i<vodData.length; i++) {
            vodData[i] = `https://vod-archive-global-cdn-z02.afreecatv.com/v101/hls/vod${vodData[i]}/original/both/playlist.m3u8`
        }
        

        const vodObject = {station_num: filteredVods[u].station_no, bbs_num: filteredVods[u].bbs_no, title_num: filteredVods[u].title_no};
        let vod = {...vodObject, ...extraData}; //+views and duration
        //vods.push(vodObjectMerged); //return {data:[links], stationNum, bbsNum, titleNum, date_reg, title 

        var thumbnailUrl = filteredVods[u].ucc.thumb;
        if(thumbnailUrl === null) {
            //in case +19 vod and no thumbnail is available (so it doesnt crash / not save the vod)
            thumbnailUrl = '';
        }

        vod.bj_id = bj_id;
        vod.thumbnail = thumbnailUrl;

        let saveVod
        
        try{
            saveVod = await _this.saveVod(vod, vodData);
        } catch(err) {
            continue;
        }

        //if duplicate entry, don't add to list 
        if(saveVod){
            vods.push(vod);
        } else {
            continue
        }
        
    }
    //console.log(vods);
    return vods;
}