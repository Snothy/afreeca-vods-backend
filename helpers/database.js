const mysql = require('promise-mysql');
const info = require('../config');

/**
 * Run an SQL query on the Database.
 * @param {string} query - The SQL query string
 * @param {string} values - The values that replace the placeholders in the query
 * @returns {object} - The mysql response object - either data we can index or information about the executed query
 * @throws {error} - Error from the mysql library representing what went wrong with the query execution
 */
exports.run_query = async function run_query (query, values) {
    try {
        const connection = await mysql.createConnection(info.config);
        const data = await connection.query(query, values);
        await connection.end();
        return data;
    } catch (error) {
        console.error(error, query, values);
        throw error;
    }
};