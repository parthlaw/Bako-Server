const { Pool, Client } = require('pg');
const pool = new Pool({
	user: 'postgres',
	host: '127.0.0.1',
	database: 'bako',
	password: '1234',
	port: 5432
});
module.exports = {
	query: (text, params, callback) => {
		return pool.query(text, params, callback);
	}
};
