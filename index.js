const Koa = require('koa');
const app = new Koa();
const cors = require('@koa/cors');
const modelStreamers = require('./models/streamers');

const streamers = require('./routes/streamers.js');

const options = {
  origin: '*'
};
app.use(cors(options));

app.use(streamers.routes());

const port = process.env.PORT || 3001;
app.listen(port, async () => {
  await modelStreamers.initFetching();
  console.log(`app listening at http://localhost:${port}`);
});
