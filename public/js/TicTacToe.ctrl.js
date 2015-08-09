var app = angular.module('TicTacToe', []);

var socket;
var fieldSize = 3;
var totalMovesMade = 0;
var multiplayer;
var isPlayerOne = true;
var connectedToOpponent = true;
var opponentTurnText = 'Opponent\'s Turn';
var playerTurnText = 'Your Turn';

app.controller('TicTacToeController', ['$scope', function($scope) {
	$scope.gameStarted = false;

	/**
	 * Initialize the game
	 */
	$scope.initGame = function() {
		$scope.gameStarted = true;
		
		$scope.field = setupField();
		totalMovesMade = 0;
		
		// Initialize socket if multiplayer
		if (multiplayer) {
			$scope.initSocket();
			$scope.statusText = 'Waiting for opponent';
		} else {
			$scope.statusText = playerTurnText;
		}
	};
	
	/**
	 * Initialize a socket to the server
	 */
	$scope.initSocket = function() {
		// If a socket is established tell the server to reset it
		if (socket) {
			socket.emit('reset');
		}
		// Initialize a new socket
		else {
			// Connect 
			var url = location.protocol + '//' + location.host;
			socket = io.connect(url, {
				reconnection: false
			});
			
			// Register events
			// New game starts
			socket.on('startGame', function(data) {
				console.log('startGame', data);
				isPlayerOne = data.isPlayerOne;
				
				// Track status
				if (!isPlayerOne) {
					$scope.statusText = opponentTurnText;
				} else {
					$scope.statusText = playerTurnText;
				}
				connectedToOpponent = true;
				
				// Refresh Angular
				$scope.$apply();
			});
			
			// Opponent has played
			socket.on('opponentMove', function(data) {
				console.log('opponentMove', data);
				
				$scope.statusText = playerTurnText;
				
				// Place the same move as the opponent
				$scope.placeMark($scope.field[data.x][data.y], data.shape, function(err, isGameOver) {
					if (err) {
						return console.log(err);
					}
					
					// Check for victory
					if (isGameOver) {
						console.log('YOU LOSE');
						$scope.statusText = 'YOU LOSE';
					}
					
					// Refresh Angular
					$scope.$apply();
				})
			});
			
			// Opponent has disconnected
			socket.on('opponentDisconnect', function() {
				console.log('opponent disconnect');
				$scope.statusText = 'Opponent disconnected';
				
				connectedToOpponent = false;
				$scope.gameStarted = false;
				
				$scope.$apply();
			});
		}
	};
	
	/**
	 * Start a new single player game
	 */
	$scope.startSinglePlayer = function() {
		multiplayer = false;
	
		$scope.initGame();
	};
	
	/**
	 * Start a new multi player game
	 */
	$scope.startMultiPlayer = function() {
		multiplayer = true;
	
		$scope.initGame();
	};
	
	/**
	 * Place the given market on the field if valid
	 *
	 * @param slot - The slot to place on
	 * @param mark - The type of the mark - cross or circle
	 * @param callback - The callback
	 */
	$scope.placeMark = function(slot, mark, callback) {
		// Too many moves have been made
		if (totalMovesMade > 8 || ($scope.statusText != playerTurnText)) {
			return;
		}
		
		// Non-empty slot
		if (slot.shape != 'empty') {
			return callback('Invalid move');
		}
		
		// Place mark and increment turn counter
		slot.shape = mark;
		totalMovesMade++;
		
		if (mark == 'cross') {
			slot.faIcon = 'close';
		} else {
			slot.faIcon = 'circle-o';
		}
		
		callback(null, $scope.isGameOver());
	};
	
	/**
	 * The player's turn
	 */
	$scope.playerTurn = function(slot) {
		var shape;
		if (isPlayerOne) {
			shape = 'cross';
		} else {
			shape = 'circle';
		}
	
		$scope.placeMark(slot, shape, function(err, isGameOver) {
			if (err) {
				return console.log(err);
			}
			
			if (multiplayer) {
				var data = {
					'slot' : slot
				};
				socket.emit('move', data);
			}
			
			// Check for victory
			if (isGameOver) {
				console.log('YOU WIN');
				$scope.statusText = 'YOU WIN';
			} else if (multiplayer) {				
				$scope.statusText = opponentTurnText;
			} else {
				$scope.computerTurn();	
			}
		});
	};
	
	/**
	 * The computer's turn
	 */
	$scope.computerTurn = function() {
		var freeSlots = $scope.getFreeMoves();
		
		var move = freeSlots[randomInt(0, freeSlots.length)];
		
		$scope.placeMark($scope.field[move.x][move.y], 'circle', function(err, isGameOver) {
			if (err) {
				console.log(err);
			}
			
			// Check for victory
			if (isGameOver) {
				console.log('COMPUTER WINS');
				$scope.statusText = 'COMPUTER WINS';
			}
		});
	};
		
	/**
	 * Reset the game
	 */
	$scope.reset = function() {
		$scope.gameStarted = false;
		$scope.statusText = null;
	};
	
	/**
	 * Get a list of all free slots on the field
	 *
	 * @return - Array of {x, y} objects
	 */
	$scope.getFreeMoves = function() {
		var result = [];
		
		for (var i = 0; i < fieldSize; i++) {
			for (var j = 0; j < fieldSize; j++) {
				if ($scope.field[i][j].shape == 'empty') {
					result.push({
						'x' : i,
						'y': j
					});
				}
			}
		}
		
		return result;
	};
	
	/**
	 * Check for victory
	 */
	$scope.isGameOver = function() {
		if (!$scope.gameStarted) {
			return false;
		}
	
		// No empty moves
		if ($scope.getFreeMoves().length <= 0) {
			$scope.statusText = 'Draw';
			return true;
		}
		
		// Disconnected opponent
		if (multiplayer && !connectedToOpponent) {
			return true;
		}
		
		// Rows
		for (var i = 0; i < fieldSize; i++) {
			if ($scope.field[i][0].shape != 'empty') {
				var win = true;
				for (var j = 1; j < fieldSize; j++) {
					win = win && ($scope.field[i][0].shape == $scope.field[i][j].shape);
				}
			
				if (win) {
					return win;
				}
			}
		}
		
		// Columns
		for (var i = 0; i < fieldSize; i++) {
			if ($scope.field[0][i].shape != 'empty') {
				var win = true;
				for (var j = 1; j < fieldSize; j++) {
					win = win && ($scope.field[0][i].shape == $scope.field[j][i].shape);
				}
				
				if (win) {
					return win;
				}
			}
		}
		
		// Diagonal 1
		if ($scope.field[0][0].shape != 'empty') {
			var win = true;
			for (var i = 1; i < fieldSize; i++) {
				win = win && ($scope.field[0][0].shape == $scope.field[i][i].shape);
			}
			
			if (win) {
				return win;
			}
		}
	
		// Diagonal 2
		if ($scope.field[0][2].shape != 'empty') {
			var win = true;
			for (var i = 1; i < fieldSize; i++) {
				win = win && ($scope.field[0][2].shape == $scope.field[i][2-i].shape);
			}
			
			if (win) {
				return win;
			}
		}

		return false;
	}
}]);

/**
 * Initialize the field
 */
function setupField() {
	var rows = [];
	
	// For each row
	for (var i = 0; i < fieldSize; i++) {
		var row = [];
		
		for (var j = 0; j < fieldSize; j++) {
			// For each column
			row.push({
				'shape' : 'empty',
				'x' : i,
				'y' : j
			});
		}
		
		rows.push(row);
	}
	
	return rows;
}

/**
 * Generate a random integer in range
 *
 * @param low - The low boundary
 * @param high - The high boundary
 */
function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}