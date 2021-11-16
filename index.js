const Koa = require('koa');
const app = new Koa();
const cors = require('@koa/cors');


const streamers = require('./routes/streamers.js');
//const vods = require('./routes/vods.js');

const options = {
    origin: '*'
};

app.use(cors(options));

app.use(streamers.routes());
//app.use(vods.routes());

const port = process.env.PORT || 3001;

app.listen(port, () => {
    console.log(`app listening at http://localhost:${port}`)
});