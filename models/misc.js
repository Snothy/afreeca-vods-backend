const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const convert = require('html-to-json-data');
const { group, text, number, href, src, uniq } = require('html-to-json-data/definitions');
//const db = require('../helpers/database');

const delay = millis => new Promise((resolve, reject) => {
    setTimeout(_ => resolve(), millis)
});

writeLogsToFile = (getVideoInfoApiBody) => {
    var logger = fs.createWriteStream('logs.txt', {
        flags: 'a' //to append
    })

    logger.write(getVideoInfoApiBody + '\r\n');
    logger.write(' ' +'\r\n');
    logger.write(' ' +'\r\n');
}

writeVodsToFile = (bj_id, thumbnailUrl, backupUrl, urlList) => {
    //write to an existing notepad. create one if it doesn't exist (same dir as js file)
    //new line with bj name and date
    //thumbnail url
    //backup url from thumbnail data (old version)
    //followed by links to all segments of vod
    var logger = fs.createWriteStream('vods.txt', {
        flags: 'a' //to append
    })
    const date = new Date().toLocaleDateString();

    logger.write(bj_id + ' ' + date + '\r\n');
    logger.write('Thumbnail: ' + thumbnailUrl + '\r\n');
    logger.write('Backup URL:' + backupUrl + '\r\n');
    logger.write('VOD LINKS: ' + '\r\n');
    if(urlList.length !== 0) {
        urlList.forEach(element => {
            logger.write(element + '\r\n');
        });
    }

    logger.write(' ' +'\r\n');
    logger.write(' ' +'\r\n');

    return 0;
}

//var strList = [];
searchString = (str, target, array) => {
    //get all index positions of target string
    //returns list with target strings
    var index;
    index = str.indexOf(target);
    if(index === -1) {
        return array
    }


    //add case for HIDE.mp4 (missing segment)
    const hideStr = str.slice(index, index+83);
    if(hideStr.includes('HIDE')) {
        return searchString(str.slice(index+83), target, array);
    }

    //add case for if array > 9 and change the slicing (_9 -> _10, it cuts out the 0)
    if(array.length >= 9) {
        
        //mp4 case
        if(str.slice(index, index+90).includes('mp4')) {
            array.push(str.slice(index+69, index+119)+'.mp4');
            return searchString(str.slice(index+119), target, array);
        }

        array.push(str.slice(index+70, index+120)+'.smil');
        return searchString(str.slice(index+120), target, array);
    }

    //add case for .mp4 instead of .smil file
    if(str.slice(index, index+90).includes('mp4')) {
        array.push(str.slice(index+69, index+118)+'.mp4');
        return searchString(str.slice(index+118), target, array);
    }

    array.push(str.slice(index+70, index+119)+'.smil');
    return searchString(str.slice(index+119), target, array);
}

createNewVodLink = (thumbnailUrl) => {
    thumbData = thumbnailUrl.slice(53, 82);
    vidId = thumbData.slice(18, 27);
    vidDate = thumbData.slice(0, 8);
    vidSectionNum = thumbData.slice(9, 17);
    vidThreeDigit = thumbData.slice(24,27);
    segmentNum = thumbData.slice(28, 29);

    vodURL = 'https://vod-archive-global-cdn-z02.afreecatv.com/v101/hls/vod/' + vidDate +'/' + vidThreeDigit + '/' +vidId + '/REGL_' + vidSectionNum +'_' + vidId+ '_' + segmentNum +'.smil/original/both/playlist.m3u8';
    return vodURL;
}

//exports.createNewVodLinkV2 =  async function createNewVodLinkV2 (cookie, stationNum, bbsNum, titleNum) {
createNewVodLinkV2 = async (cookie, stationNum, bbsNum, titleNum) => {
    var apiUrl = `https://stbbs.afreecatv.com/api/video/get_video_info.php?nStationNo=${stationNum}&nBbsNo=${bbsNum}&nTitleNo=${titleNum}&adultView=ADULT_VIEW`;
    var res, body;
    try {
        res = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                cookie: cookie
            }
        });
        body = await res.text();
        //console.log(body);
        writeLogsToFile(body);
    }
    catch(err) {
        console.log(err);
    }

    let emptyArr = [];
    const vodData = searchString(body, 'vod-archive', emptyArr);

    if(!vodData.length) {
        return false;
    }


    //could also obrain all this info from the initial URL (where i get the thumbnail)
    //genuinely just easier than xml2json conversion
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

    /*
    var date_reg = body.indexOf('reg_date');
    date_reg = body.slice(date_reg+9, date_reg+19);
    */

    const title = 'TestTitle';

    const vodObject = {data:vodData, station_num: stationNum, bbs_num: bbsNum, title_num: titleNum};
    const vodObjectMerged = {...vodObject, ...extraData}; //+views and duration
    return vodObjectMerged; //return {data:[links], stationNum, bbsNum, titleNum, date_reg, title 
}

function convertTZ(date, tzString) {
    return new Date((typeof date === "string" ? new Date(date) : date).toLocaleString("en-US", {timeZone: tzString}));   
}

module.exports = {
    delay: delay,
    writeLogsToFile: writeLogsToFile,
    writeVodsToFile: writeVodsToFile,
    searchString: searchString,
    createNewVodLink: createNewVodLink,
    createNewVodLinkV2: createNewVodLinkV2,
    convertTimezone: convertTZ
}






//Home - getAll, RefreshAll, RefreshId, getById | sort by live
//addStreamer either on home or new page
//:id - getAllVods  maybe add (fetch all public vods)
//:id/:vodId - getVodData

//maybe getAll should call refreshAll (react SPA, only calls getAll once realistically)