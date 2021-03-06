// const info = require('../config');
const pgp = require('pg-promise')();

// const db = pgp(info.config);

const db = pgp({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

exports.run_query = async function run_query (query, values) {
  let res;
  try {
    res = await db.any(query, values);
    return res;
  } catch (err) {
    console.error(err);
  }
};

exports.run_query_insert = async function run_query_insert (query, values) {
  let res;
  try {
    res = await db.one(query, values);
    return res;
  } catch (err) {
    if (err.code === '23505') {
      // do nothing, just unable to add duplicate primary key value
    } else {
      console.log(err);
    }
  }
};

exports.run_query_remove = async function run_query_remove (query, values) {
  try {
    const { rowCount } = await db.result(query, values);
    return rowCount;
  } catch (err) {
    console.error(err);
  }
};
