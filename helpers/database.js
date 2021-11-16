const info = require('../configTemplate');
const pgp = require('pg-promise')();

const cn = process.env.DATABASE_URL || info.config;
const db = pgp(cn);

exports.run_query = async function run_query(query, values) {
  let res;
  try {
    res = await db.any(query, values);
    return res;
  } catch(err) {
    console.error(err);
  }
}

exports.run_query_insert = async function run_query_insert(query, values) {
  let res;
  try {
    res = await db.one(query, values);
    return res;
  } catch(err) {
    console.error(err);
  }
}

exports.run_query_remove = async function run_query_remove(query, values) {
  try {
    const {rowCount} = await db.result(query, values);
    return rowCount;
  } catch(err) {
    console.error(err);
  }
}