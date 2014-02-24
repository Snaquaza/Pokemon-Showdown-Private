 /*******************************************************************************************
  * Mafia Variables *************************************************************************
  ******************************************************************************************/
 
global.mGame = exports.mGame = false;
var mGameStarting = false;
var mDayTime = false;
global.mNightTime = exports.mNightTime = false;
var mCounted = false;
var mPlayers = new Array();
var mRooms = require('../rooms.js');
var mNumVotes = 0;
var mNumMob = 0;
var mNumVillager = 0;
var mKillTarget = "";
var mTimer;
var mTheme = {};
var mRolesOrder = [];
var mRolesIndex = 1;

// Shuffle function courtesy of StackOverflow. If this doesn't work, I'll try something else. :P
function mShuffle(array) {
  var currentIndex = array.length
    , temporaryValue
    , randomIndex
    ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function mEndGame() {
	mGame = exports.mGame = false;
	for (var i=0; i<mPlayers.length; i++) {
		mPlayers[i].inMafia = false;
	}
}

global.mRemove = exports.mRemove = function(user, leave) {
	if (leave) {
		mRooms.rooms.mafia.send(user + " has left the game.");
	} else {
		mRooms.rooms.mafia.send(user + " has been killed.");
	}
	var mPlayI = mPlayers.indexOf(user);
	if ( user.mGroup === 'villager'){
		mNumVillager--;
	} else if ( user.mGroup === 'mafia'){
		mNumMob--;
	}
	mPlayers[mPlayI].inMafia = false;
	mPlayers.splice(mPlayI, 1);
	if (mNumVillager === 0){
		mRooms.rooms.mafia.add("All villagers have been killed. The mafia win!");
		mEndGame();
	}else if (mNumMob === 0){
		mRooms.rooms.mafia.add("All mafia have been killed. The villagers win!");
		mEndGame();
	}
}

function mNight() {
	if (!mGame) { return; }
	mRooms.rooms.mafia.send('It is now night. Mafia members, you have 30 seconds to choose a player to kill.');
	mNightTime = exports.mNightTime = true;
	mDayTime = false;
	setTimeout(function(){
		if (!mGame) { return; }
		if(mKillTarget !== ""){
			mRemove(mKillTarget);
			mKillTarget = "";
		} else {
			mRooms.rooms.mafia.send('No one was killed.');
		}
		mInterval();
	}, 30000);
}

function mCount() {
	if (mCounted || !mGame) { return; }
	mRooms.rooms.mafia.send('Counting votes.');
	mCounted = true;
	var mChosen = mPlayers[0];
	var mChosenNum = 0;
	var mTie = false;
	for (var i=0; i<mPlayers.length; i++) {
		if (mPlayers[i].votes > mChosenNum) {
			mChosen = mPlayers[i];
			mChosenNum = mChosen.votes;
			mTie = false;
		} else if (mPlayers[i].votes === mChosenNum) {
			mTie = true;
		}
	}
	if (mTie) {
		mRooms.rooms.mafia.send('No majority was reached.');
	} else {
		mRemove(mChosen, false);
	}
	mNight();
}

function mDay() {
	if (!mGame) { return; }
	mRooms.rooms.mafia.send('It is now day. You have 30 seconds to vote on a person to kill.');
	mDayTime = true;
	mCounted = false;
	mNumVotes = 0;
	mTimer = setTimeout(mCount, 30000);
}

function mInterval() {
	if (!mGame) { return; }
	mNightTime = exports.mNightTime = false;
	mDayTime = false;
	mRooms.rooms.mafia.send('You have 60 seconds to discuss.');
	for (var i=0; i<mPlayers.length; i++) {
		mPlayers[i].voted = false;
		mPlayers[i].votes = 0;
	}
	setTimeout(mDay, 60000);
}

function mGameStart() {
	if (!mGameStarting ) { return; }
	if (mPlayers.length < 4) {
		mRooms.rooms.mafia.add('At least 4 players are required to play. Retrying in 30 seconds.');
		setTimeout(mGameStart, 30000);
		return;
	}
	mGameStarting = false;
	mGame = exports.mGame = true;
	/*
	mShuffle(mPlayers);
	for (var q=0; i<mPlayers.length; q++) {
		mPlayers[q].mRole = mTheme["roles" + mRolesIndex][q]
	}
	*/
	mNumMob = 0;
	mNumVillager = 0;
	mRooms.rooms.mafia.add('A new mafia game has begun. Players: ' + mPlayers);
	for (var i=0; i<mPlayers.length; i++) {
		mPlayers[i].inMafia = true;
		mPlayers[i].mGroup = 'villager';
	}
	for (var j=0; j<(mPlayers.length*.25); j++) {
		var mPlayer = Math.floor(Math.random()*mPlayers.length);
		mPlayers[mPlayer].mGroup = 'mafia';
		mPlayers[mPlayer].sendTo(mRooms.rooms.mafia, "You are a mafia member. Attempt to kill the villagers.");
		mNumMob++;
	}
	for (var k=0; k<mPlayers.length; k++) {
		if (mPlayers[k].mGroup === 'mafia') { continue; }
		mPlayers[k].sendTo(mRooms.rooms.mafia, "You are a villager. Attempt to find out who the mafia are.");
		mNumVillager++;
	}
	mInterval();
}

	/*********************************************************
	 * Mafia commands
	 *********************************************************/

var commands = exports.commands = {

	mstart: function(target, room, user, connection) {
		if (room !== mRooms.rooms.mafia || !user.can('broadcast')) { return; }
		if (mGame) {
			this.sendReplyBox('A game is currently being played.');
		} else {
			mPlayers = [];
			mGameStarting = true;
			room.add('A new mafia game is starting. Type /mjoin to join.');
			mRooms.lobby.add('A new mafia game is starting. Join the Mafia room and type /mjoin to join.');
			/*
			mRooms.lobby.add(mTheme.name);
			mRooms.lobby.add(mTheme.author);
			mRooms.lobby.add(mTheme.summary);
			mRolesOrder = mTheme.roles1;
			mRolesIndex = 1;
			*/
			mTimer = setTimeout(function() {room.add('60 seconds remaining to join.'); setTimeout(mGameStart, 60000);}, 60000)
		}
	},

	mjoin: function(target, room, user, connection) {
		if (!mGameStarting || room !== mRooms.rooms.mafia) { return; }
		if (mPlayers.indexOf(user) !== -1){
			this.sendReplyBox('You have already joined the next mafia game.');
			return;
		}
		mPlayers.push(user);
		this.sendReplyBox('You have joined the mafia game.');
		/*
		if (mTheme["roles" + mRolesIndex].length <= mPlayers.length) {
			try {
				mRolesIndex++;
				mRolesOrder = mTheme["roles" + mRolesIndex];
			}
			catch(e) {
				room.add('Sign-up full. Starting game.');
				clearTimeout(mTimer)
				mGameStart()
			}
		}
		*/
	},

	mkill: function(target, room, user, connection) {
		if (!mGame || room !== mRooms.rooms.mafia) { return; }
		if (user.mGroup !== 'mafia'){
			this.sendReplyBox('You are not a member of the mafia.');
			return;
		}
		if (!mNightTime){
			this.sendReplyBox('It is not night.');
			return;
		}
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (targetUser.mGroup === 'mafia'){
			this.sendReplyBox('You cannot kill a member of the mafia.');
			return;
		}
		if (mPlayers.indexOf(targetUser) === -1){
			this.sendReplyBox('That player is not in the game.');
			return;
		}
		mKillTarget = targetUser;
	},

	mvote: function(target, room, user, connection) {
		if (!mGame || room !== mRooms.rooms.mafia) { return; }
		if (mPlayers.indexOf(user) === -1){
			this.sendReplyBox('You are not playing.');
			return;
		}
		if (!mDayTime){
			this.sendReplyBox('It is not day.');
			return;
		}
		if (user.voted) {
			this.sendReplyBox('You have already voted.');
			return;
		}
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (mPlayers.indexOf(targetUser) === -1){
			this.sendReplyBox('That player is not in the game.');
			return;
		}
		this.send(user + ' voted for ' + targetUser + '.');
		user.voted = true;
		targetUser.votes = targetUser.votes+1;
		mNumVotes++;
		if (mNumVotes === mPlayers.length) {
			this.send("All players have voted.");
			clearTimeout(mTimer);
			mCount();
		}
	},

/*
	mchat: function(target, room, user, connection) {
		if (!mGame || room !== mRooms.rooms.mafia) { return; }
		if (user.mGroup !== 'mafia'){
			this.sendReplyBox('You are not a member of the mafia.');
			return;
		}
		for (var i=0; i<mPlayers.length; i++) {
			if (mPlayers[i].mGroup === 'mafia') {
				mPlayers[i].send("Mafia " + user + ": " + target);
			}
		}
	},
*/

	mstop: function(target, room, user, connection) {
		if (!mGame || room !== mRooms.rooms.mafia || !user.can('broadcast')) { return; }
		mEndGame();
	},

	mcancel: function(target, room, user, connection) {
		if (!mGameStarting || room !== mRooms.rooms.mafia || !user.can('broadcast')) { return; }
		mRooms.rooms.mafia.add('Mafia game cancelled.');
		mGameStarting = false;
	}

};
