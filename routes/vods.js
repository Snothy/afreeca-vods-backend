const Router = require('koa-router');
const bodyparser = require('koa-bodyparser');
const modelStreamers = require('../models/streamers');
const modelVods = require('../models/vods');

const router = Router({ prefix: '/api/streamers/:id([a-zA-Z0-9]{1,})' });

router.get('/vods', getStreamerVods);

router.get('/:vodId([0-9]{1,})', getVodData);
router.post('/:vodId([0-9]{1,})', removeVod);

router.post('/fetchVods', bodyparser(), fetchXVods);
router.post('/fetchVodsDb', bodyparser(), fetchXVodsDb);
router.post('/fetch', bodyparser(), fetchNewVod);
router.post('/cancelFetch', bodyparser(), cancelFetch);

async function getStreamerVods (ctx) {
  // returns all vods for a specific streamer
  // sort vods by reg_data on front end
  const id = ctx.params.id;
  const result = await modelVods.getStreamerVods(id);
  if (result) {
    if (result.length) {
      const vods = result;
      return ctx.body = vods;
    } else {
      ctx.status = 404;
    }
  }
}

async function fetchXVods (ctx) {
  const id = ctx.params.id;
  if (ctx.request.body.num == null || ctx.request.body.cookie == null) {
    return ctx.body = { success: false, message: 'Incorrect request form.' };
  }
  const cookie = ctx.request.body.cookie;
  const numOfVods = ctx.request.body.num;
  const result = await modelVods.fetchXVods(id, numOfVods, cookie);
  if (result) {
    if (result.length) {
      return ctx.body = { success: true, vods: result };
    } else {
      return ctx.body = { success: false, message: 'No vods found.' };
    }
  }
}

async function fetchXVodsDb (ctx) {
  const id = ctx.params.id;
  // Check if the correct body has been provided
  if (ctx.request.body.num == null || ctx.request.body.cookie == null) {
    return ctx.body = { success: false, message: 'Incorrect request form.' };
  }
  const cookie = ctx.request.body.cookie;
  const numOfVods = ctx.request.body.num;
  const result = await modelVods.fetchXVodsDb(id, numOfVods, cookie);
  if (result) {
    if (result.length) {
      return ctx.body = { success: true, vods: result };
    } else {
      return ctx.body = { sucess: false, message: 'No new vods found. Try logging in as some vods are only avilable for logged in users.' };
    }
  } else {
    ctx.status = 404;
  }
}

async function getVodData (ctx) {
  const vodId = ctx.params.vodId;

  const result = await modelVods.getVodData(vodId);
  if (result) {
    if (result.length) {
      const vodData = result;
      return ctx.body = vodData;
    } else {
      ctx.status = 404;
    }
  }
}

async function removeVod (ctx) {
  const vodId = ctx.params.vodId;

  const result = await modelVods.removeVod(vodId);
  if (result > 0) {
    ctx.status = 200;
    return ctx.body = { removed: true };
  } else {
    ctx.status = 400;
    ctx.body = { removed: false };
  }
}

async function fetchNewVod (ctx) {
  const id = ctx.params.id;
  const cookie = ctx.request.body.cookie;
  const bj = await modelStreamers.getById(id);

  // isFetching(bj_id)
  // if true -> already fetching
  // once fetch complete set back to false
  // upon running of API set all to false
  const fetching = await modelStreamers.getFetching(id);

  // streamer live, not fetching => fetch allowed
  if (bj[0].is_live && !fetching) {
    const result = await modelVods.fetchNewVod(id, cookie);
    // const result = 1;
    if (result === 1) {
      return ctx.body = { success: true, message: `Successfully fetched VOD for ${id}` };
    } else if (result === 0) {
      return ctx.body = { success: true, message: `Cancelled VOD fetch for ${id}` };
    }
    // streamer live, already fetching
  } else if (bj[0].is_live && fetching) {
    return ctx.body = { success: false, fetching: true, message: 'Already fetching' };
    // streamer not live (unable to fetch)
  } else {
    return ctx.body = { success: false, fetching: false, message: 'Streamer not live or inability to fetch' };
  }
}

async function cancelFetch (ctx) {
  const id = ctx.params.id;
  if (!await modelStreamers.getFetching(id)) return ctx.body = { success: false, message: 'Not fetching' };

  const result = await modelStreamers.updateFetching(id, false);
  if (result) {
    return ctx.body = { success: true, message: 'Cancelling fetch' };
  } else {
    return ctx.body = { success: false, message: 'Could not cancel Fetch' };
  }
}

module.exports = router;
