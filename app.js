var express = require('express'),
	http = require('http'),
	uuid = require('uuid'),
	socketIO = require('socket.io');
	
var pairedSockets = {};		// Active player pairs
var queuedPlayers = [];		// Queue of players
	
// Initialize server
var app = express(),
	server = http.Server(app),
	io = socketIO(server);

// Express config
app.use(express.static('public'));

// Socket.io config
io.on('connection', function(socket) {
	// Add the socket to the player queue or pair him witht the first player
	queueOrPairSocket(socket);
	
	// Player has made a move
	socket.on('move', function(data) {
		var opponentSocket = pairedSockets[socket.opponentUUID];
		opponentSocket.emit('opponentMove', data.slot);
	});
	
	// A player has disconnected
	socket.on('disconnect', function() {
		console.log('Player disconnected');
				
		// Remove socket from queue if it was there
		var queueIndex = queuedPlayers.indexOf(socket);
		
		if (queueIndex > -1) {
			queuedPlayers.splice(socket);
		}
		
		// Select his opponent
		var opponentSocket = pairedSockets[socket.opponentUUID];
		
		// Notify opponent is any
		if (opponentSocket) {
			opponentSocket.emit('opponentDisconnect');
			delete pairedSockets[opponentSocket.opponentUUID];
		}
		
		// Remove player from active pairs
		delete pairedSockets[socket.opponentUUID];
	});
	
	// Client has clicked "Play Again"
	socket.on('reset', function() {
		console.log('reset');
		
		// Select player's socket
		var opponentSocket = pairedSockets[socket.opponentUUID];
		
		// Remove from active pairs
		delete pairedSockets[socket.opponentUUID];
		
		// Remove opponent
		if (opponentSocket) {
			delete pairedSockets[opponentSocket.opponentUUID];
		}
		
		// Place on queue or pair
		queueOrPairSocket(socket);
	});
});

/**
 * Add a socket to a queue or if the queue contains at least one other socket pair the two.
 *
 * @param socket - the new socket that has connected
 */
function queueOrPairSocket(socket) {
	// Pair
	if (queuedPlayers.length > 0) {
		console.log('PAIRED');
		// Remove first socket from queue
		var opponentSocket = queuedPlayers.shift();
		
		// Generate UUIDs
		var playerUUID = uuid.v4();
		var opponentUUID = uuid.v4();
		
		// Pair the two sockets
		pairedSockets[playerUUID] = opponentSocket;
		pairedSockets[opponentUUID] = socket;

		// Assign them their UUIDs
		socket.opponentUUID = playerUUID;
		opponentSocket.opponentUUID = opponentUUID;
		
		// Notify them to start playing with their respective UUIDs
		socket.emit('startGame', {
			'isPlayerOne' : false
		});
		
		opponentSocket.emit('startGame', {
			'isPlayerOne' : true
		});
	}
	// Add to queue
	else {
		console.log('QUEUED');
		queuedPlayers.push(socket);
	}
}

// Start server
server.listen(3000, function() {
	console.log('Server started');
});