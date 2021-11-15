const Router = require('koa-router');
const bodyparser = require('koa-bodyparser');
const modelStreamers = require('../models/streamers');
const modelVods = require('../models/vods');

const router = Router({ prefix: '/api/streamers' });

router.get('/', getAll);
router.post('/', bodyparser(), addStreamer);
router.post('/a/login', bodyparser(), login);

router.get('/:id([a-zA-Z0-9]{1,})', getById); 
router.del('/:id([a-zA-Z0-9]{1,})', removeStreamer); 

router.get('/:id([a-zA-Z0-9]{1,})/vods', getStreamerVods);
router.post('/:id([a-zA-Z0-9]{1,})/fetchVods', bodyparser(), fetchXVods);
router.get('/:id([a-zA-Z0-9]{1,})/:vodId([0-9]{1,})', getVodData);

router.get('/refresh/all', refreshAll);
router.get('/refresh/all/fast', refreshAllFast);
router.get('/refresh/:id([a-zA-Z0-9]{1,})', refreshId);

router.post('/:id([a-zA-Z0-9]{1,})/fetch', bodyparser(), fetchNewVod);

async function getAll(ctx) {
    //maybe call update function (update streamer (live, recent stream))
    const result = await modelStreamers.getAll();
    if(result.length) {
        return ctx.body = result;
    }
}

async function getById (ctx) {
    const id = ctx.params.id;

    const result = await modelStreamers.getById(id);
    //const aaa = await modelStreamers.isLive(id);
    //const bbb = await modelStreamers.getData('flower1023');
    //const ccc = await modelStreamers.addStreamer('dbwlsqwe');
    //const ddd = await modelStreamers.refreshAll();
    if (result.length) {
        const streamer = result[0];
        return ctx.body = streamer;
    }
}

async function removeStreamer (ctx) {
    const id = ctx.params.id;
    //console.log(id);

    const result = await modelStreamers.removeStreamer(id);
    if(result.affectedRows) {
        ctx.status = 200;
        ctx.body = {removed: true};
    }
}

async function addStreamer (ctx) {
    const bj_id = ctx.request.body.bj_id;
    const result = await modelStreamers.addStreamer(bj_id);
    if (result.affectedRows) {
        ctx.status = 201;
        ctx.body = {created: true};
    }

}

async function login (ctx) {
    const username = ctx.request.body.username;
    const password = ctx.request.body.password;
    //console.log(password);

    const response = await modelStreamers.login(username, password);
    
    //essentially "if login was successful"
    if(JSON.parse(response.body).RESULT === 1) {
        ctx.status = 200;
        //console.log('a');
        ctx.body = {login: true, headers: response.headers}; //response object .headers['set-cookies'] for list of all cookies
    } else {
        //console.log('b');
        ctx.body = {login: false};
    }
    //console.log(response);
    //const result = JSON.parse(response.body).RESULT
    //console.log(response.body);
    /*
    console.log(login[0]);
    if(login[0] === 1) {
        const data = login[1].headers; //response object .headers['set-cookies'] for list of all cookies
        ctx.status = 200;
        ctx.body = {login: true, data: login[1]};
    } else {
        ctx.body = {login: false};
    }
    */
     
}

async function getStreamerVods (ctx) {
    //returns all vods for a specific streamer
    //sort vods by reg_data on front end
    const id = ctx.params.id;
    const result = await modelVods.getStreamerVods(id);
    //console.log(result);
    if (result.length) {
        const vods = result;
        return ctx.body = vods;
    }
}

async function fetchXVods (ctx) {
    //console.log('a');
    const id = ctx.params.id;
    const cookie = ctx.request.body.cookie;

    const result = await modelVods.fetchXVods(id, 40, cookie); 
    
    if(result.length) {
        return ctx.body = result; 
    } 
    
}

async function getVodData (ctx) {
    //const id = ctx.params.id;
    const vodId = ctx.params.vodId;

    const result = await modelVods.getVodData(vodId);
    if (result.length) {
        const vodData = result;
        return ctx.body = vodData;
    }
}

async function refreshAll (ctx) {
    const result = await modelStreamers.refreshAll();
    if (result.length) {
        ctx.status = 200;
        return ctx.body = result;
    }
}

async function refreshAllFast(ctx) {
    const result = await modelStreamers.refreshAllFast();
    
    if(result.length) {
        ctx.status = 200;
        return ctx.body = result;
    }
    
}

async function refreshId (ctx) {
    const id = ctx.params.id;
    const result = await modelStreamers.isLive(id);
    return ctx.body = result;
}

async function fetchNewVod (ctx) {
    const id = ctx.params.id;
    const cookie = ctx.request.body.cookie;
    //console.log(cookie);
    //create local react state variable fetch 
    //pending until this route returns something
    //it shoulds top fetching upon refersh & the variable also resets upon refresh
    const result = await modelVods.fetchNewVod(id, cookie);

    if (result === 1 ) {
        return ctx.body = {success: true};
    }
    
}

module.exports = router;