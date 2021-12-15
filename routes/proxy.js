const Router = require('koa-router');
// const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const req = require('request');

const router = Router({ prefix: '/api' });
router.get('/proxy/:url(.*)*', proxyURL);

async function proxyURL (ctx) {
  const query = ctx.request.query;
  const base = ctx.params.url;
  let url;
  // Append all query parameters onto base URL if there are any
  if (Object.keys(query).length !== 0) {
    const props = Object.keys(query);
    for (let i = 0; i < props.length; i++) {
      if (i === 0) {
        url = `${base}?${props[i]}=${query[props[i]]}`;
        continue;
      }
      url = `${url}&${props[i]}=${query[props[i]]}`;
    }
  } else {
    url = base;
  }

  try {
    // const res = await fetch(url);
    // ctx.set('Content-Type', res.headers.get('content-type'));
    // ctx.body = res.body;
    // ctx.redirect(url);
    ctx.body = req(url);
  } catch (err) {
    ctx.status = 404;
  }
}

module.exports = router;
