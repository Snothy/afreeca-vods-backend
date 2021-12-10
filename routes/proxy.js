const Router = require('koa-router');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

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
    const res = await fetch(url);
    // ctx.type = 'html';
    ctx.body = res.body;
  } catch (err) {
    ctx.status = 404;
  }
}

module.exports = router;
