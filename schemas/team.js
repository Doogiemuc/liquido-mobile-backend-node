/**
 * Mongoose Schmea for a Team with its members
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema


/**
 * Each team has an invite code. This code is meant to be sent to other users that then can register as a member.
 * The requirements for such an invite code are:
 *  - It MUST be possible to deterministically calculate the invite code from a given input value, e.g. the team name.
 *  - It MUST be very different even for similar input values.
 *  - It MUST be short.
 *  - It MUST be easy to type on a mobile device
 *  - It MUST NOT contain characters that can easily be swapped
 * 
 * adapted from
 * https://stackoverflow.com/questions/3426404/create-a-hexadecimal-colour-based-on-a-string-with-javascript
 * https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript    Niiiiceee high quality hash function in 89 chars :-)
 * // var TSH = s => { for (var i = 0, h = 9; i < s.length;)h = Math.imul(h ^ s.charCodeAt(i++), 9 ** 9); return h ^ h >>> 9 }
 */
var SAFE_CHARS = 'ABCDEFGHKLMNPQRSTUVWXYZ23456789'   // no 1,I,J, and no O,0 because these charsacters can be accidentically swapped so easily when printed.
var createInviteCode = function (str, len = 6) {
	if (!str) throw new Error("Need str to create invite code!")
	var hash = 0;
	for (var i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	var inviteCode = '';
	var pos = 0
	for (let i = 0; i < len; i++) {
		pos = (pos + hash) % SAFE_CHARS.length
		inviteCode += SAFE_CHARS[Math.abs(pos)]
	}
	return inviteCode;
}

module.exports = {

	// Name of this time
	teamname: {
		type: String,
		required: "Teamname is required",
		unique: true
	},

	// Invite code that can easily be shared to other users
	inviteCode: {
		type: String,
		required: "Team needs an inviteCode",
		default: function () {
			return createInviteCode(this.teamname)
		},
		unique: true
	},

	// Array of team members. The first user (index===0) is the admin of the team.
	// Yes arrays in mongoDB keep their order.
	// If the first user quits the team, then the next user automatically becomes the admin (by definition).
	members: [
		{
			name: {
				type: String,
				trim: true,
				required: "User name is required",
			},
			email: {
				type: String,
				trim: true,
				lowercase: true,
				unique: true, 				// Each email may appear only once within ONE Team. But the same user MAY also be a member of OTHER teams.
				required: 'Email address is required',
				//validate: [validateEmailFunc, 'Please fill a valid email address'],
				match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
			}
		}
	]

}
