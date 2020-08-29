const express = require('express');
const bcrypt = require('bcrypt');
const app = express();
const cors = require('cors');
let jwt = require('jsonwebtoken');
let config = require('./config');
let middleware = require('./middleware');
const bp = require('body-parser');
const db = require('./db');
const socket = require('socket.io');
const { response } = require('express');
app.use(bp.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
	res.json('Hi');
});

const users = [];

const addUser = ({ id, name, room }) => {
	name = name.trim().toLowerCase();
	room = room.trim().toLowerCase();

	const existingUser = users.find((user) => user.room === room && user.name === name);

	if (!name || !room) return { error: 'Username and room are required.' };
	if (existingUser) return { error: 'Username is taken.' };

	const user = { id, name, room };

	users.push(user);

	return { user };
};

const removeUser = (id) => {
	const index = users.findIndex((user) => user.id === id);

	if (index !== -1) return users.splice(index, 1)[0];
};

const getUser = (id) => users.find((user) => user.id === id);

const getUsersInRoom = (room) => users.filter((user) => user.room === room);
app.post('/register', (req, res) => {
	const { email, username, password } = req.body;
	const hash = bcrypt.hashSync(password, 10);
	db.query(
		'INSERT INTO users(username,email,password) VALUES($1,$2,$3)',
		[ username, email, hash ],
		(err, response) => {
			console.log(err, response);
		}
	);
	res.json('success');
});
app.post('/login', (req, res) => {
	const { username, password } = req.body;
	const query = 'SELECT password FROM login WHERE "username" = $1';
	db.query(query, [ username ], (err, response) => {
		if (err) {
			console.log(err.stack);
		} else {
			if (!response.rows[0]) {
				res.json('incorrect username');
			} else {
				const hash = response.rows[0].password;
				bcrypt.compare(password, hash, function(err, result) {
					if (err) {
						console.log(err);
					}
					if (result == true) {
						let token = jwt.sign({ username: username }, config.secret, { expiresIn: '24h' });
						res.json({
							success: true,
							message: 'Authentication successful!',
							token: token
						});
					} else {
						res.json('incorrect password');
					}
				});
			}
		}
	});
});
app.post('/room', middleware.checkToken, (req, res) => {
	const { roomName, creater, password } = req.body;
	const hash = bcrypt.hashSync(password, 10);
	db.query(
		'INSERT INTO rooms(roomname,creater,password) VALUES ($1,$2,$3)',
		[ roomName, creater, hash ],
		(err, response) => {
			console.log(err, response);
			if (err) {
				res.json('Fail');
			}
			res.json('Success');
		}
	);
});
app.post('/join', middleware.checkToken, (req, res) => {
	const { roomName, password, token } = req.body;
	const query = 'SELECT password FROM rooms WHERE "roomname" = $1';
	db.query(query, [ roomName ], (err, response) => {
		if (err) {
			console.log(err.stack);
		} else {
			if (!response.rows[0]) {
				res.json('incorrect roomName');
			} else {
				const hash = response.rows[0].password;
				bcrypt.compare(password, hash, function(err, result) {
					if (err) {
						console.log(err);
					}
					if (result == true) {
						res.json('entry successfull');
					} else {
						res.json('incorrect password');
					}
				});
			}
		}
	});
});
app.post('/list', (req, res) => {
	const { username } = req.body;
	console.log(username);
	db.query('SELECT username,roomname FROM joined WHERE "username"=$1', [ username ], (err, response) => {
		if (err) {
			console.log(err);
		}
		res.json(response.rows);
	});
});
app.post('/chat', middleware.checkToken, (req, res) => {
	const { room } = req.body;
	db.query('SELECT user,text FROM chat WHERE "room"=$1', [ room ], (err, response) => {
		if (err) {
			console.log(err);
		}
		res.json(response.rows);
	});
});
app.post('/chatCheck', middleware.checkToken, (req, res) => {
	res.json('Authorized');
});
app.post('/dash', (req, res) => {
	const { username } = req.body;
	db.query('SELECT userid,username,email FROM users WHERE "username"=$1', [ username ], (err, response) => {
		if (err) {
			console.log(err);
		}
		res.json(response.rows[0]);
	});
});
app.get('/logout', (req, res) => {
	console.log('logged out');
});

const server = app.listen(process.env.PORT || 3001, () => {
	console.log(`App is running on ${process.env.PORT}`);
});
var data = [];
const io = socket(server);
io.on('connection', (socket) => {
	console.log('connection', socket.id);

	socket.on('join', ({ name, room }, callback) => {
		const { error, user } = addUser({ id: socket.id, name, room });
		if (error) return callback(error);

		socket.join(user.room);

		socket.emit('message', { user: 'admin', text: `${user.name}, welcome to room ${user.room}.` });
		socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined!` });

		io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

		callback();
	});

	socket.on('sendMessage', (message, callback) => {
		const user = getUser(socket.id);
		io.to(user.room).emit('message', { user: user.name, text: message });

		callback();
	});
	socket.on('disconnect', () => {
		const user = removeUser(socket.id);

		if (user) {
			io.to(user.room).emit('message', { user: 'Admin', text: `${user.name} has left.` });
			io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
		}
	});
});
