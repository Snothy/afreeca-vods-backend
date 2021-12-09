const Router = require('koa-router');
const bodyparser = require('koa-bodyparser');
const modelStreamers = require('../models/streamers');

const router = Router({ prefix: '/api/streamers' });

router.get('/', getAll);
router.post('/', bodyparser(), addStreamer);
router.post('/browse', bodyparser(), getBrowse);
router.post('/login', bodyparser(), login);

router.get('/:id([a-zA-Z0-9]{1,})', getById);
router.del('/:id([a-zA-Z0-9]{1,})', removeStreamer);
router.post('/:id([a-zA-Z0-9]{1,})/live', bodyparser(), getLive);

router.get('/refresh/all/fast', refreshAllFast);

async function getAll (ctx) {
  // maybe call update function (update streamer (live, recent stream))
  const result = await modelStreamers.getAll();
  if (result) {
    if (result.length) {
      return ctx.body = result;
    } else {
      ctx.status = 404;
    }
  }
}

async function getById (ctx) {
  const id = ctx.params.id;

  const result = await modelStreamers.getById(id);
  if (result) {
    if (result.length) {
      const streamer = result[0];
      return ctx.body = streamer;
    } else {
      ctx.status = 404;
    }
  }
}

async function removeStreamer (ctx) {
  const id = ctx.params.id;
  // console.log(id);

  const result = await modelStreamers.removeStreamer(id);
  if (result > 0) {
    ctx.status = 200;
    ctx.body = { removed: true };
  } else {
    ctx.status = 400;
    ctx.body = { removed: false };
  }
}

async function addStreamer (ctx) {
  const bj_id = ctx.request.body.bj_id;
  const result = await modelStreamers.addStreamer(bj_id);
  if (result) {
    ctx.status = 201;
    ctx.body = { created: true };
  }
}

async function login (ctx) {
  const username = ctx.request.body.username;
  const password = ctx.request.body.password;
  const response = await modelStreamers.login(username, password);

  // essentially "if login was successful"
  if (JSON.parse(response.body).RESULT === 1) {
    ctx.status = 200;
    ctx.body = { login: true, headers: response.headers }; // response object .headers['set-cookies'] for list of all cookies
  } else {
    ctx.body = { login: false };
  }
}

async function getLive (ctx) {
  const id = ctx.params.id;
  const cookie = ctx.request.body.cookie;

  const result = await modelStreamers.getLive(id, cookie);
  if (result) {
    return ctx.body = result;
  }
}

async function getBrowse (ctx) {
  const page = ctx.request.body.page;

  const result = await modelStreamers.getBrowse(page);
  if (result.length > 0) {
    return ctx.body = result;
  } else {
    return ctx.status = 404;
  }
}

async function refreshAllFast (ctx) {
  const result = await modelStreamers.refreshAllFast();

  if (result) {
    if (result.streamers.length) {
      ctx.status = 200;
      return ctx.body = result;
    } else {
      ctx.status = 404;
    }
  }
}

module.exports = router;
