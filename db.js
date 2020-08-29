const { Pool, Client } = require('pg');
const pool = new Pool({
	user: 'vodacnmqwkqvtt',
	host: 'ec2-34-198-243-120.compute-1.amazonaws.com',
	database: 'd9kcrqk0fibjl0',
	password: '69ab9624cac81744805c4d3b4c6b163a16322f063030defc44c06b0fe99a8466',
	port: 5432
});
module.exports = {
	query: (text, params, callback) => {
		return pool.query(text, params, callback);
	}
};
