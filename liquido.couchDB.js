/**
 * Liquido Interface do CouchDB
 */
const DB_USER = "admin"
const DB_PASS = "admin"
const TEAMS_DB_NAME = "teams"
const POLLS_DB_NAME = "polls"
const PROPOSALS_DB_NAME = "proposals"
const USERS_DB_NAME = "users"

const nano = require('nano')({
	url: 'http://' + DB_USER + ':' + DB_PASS + '@localhost:5984',
})
let teams = nano.use(TEAMS_DB_NAME)
let polls = nano.use(POLLS_DB_NAME)
let proposals = nano.use(PROPOSALS_DB_NAME)
let users = nano.use(USERS_DB_NAME)

/**
 * Create a new Team
 * @param {JSON} newTeam = {
 *   teamname: "My new Team",
 *   admin: {
 *     name: "John Doe",
 *     email: "john@yahoo.com"
 *   }
 * }
 */
let createNewTeam = async function (newTeam) {
	console.log("Creating new Team in DB: ", JSON.stringify(newTeam))
	if (!isText(newTeam.teamname)) {
		throw new Error("Need 'teamname' as text: " + newTeam.teamname)
	}
	if (await teamExists(newTeam.teamname)) {
		throw new Error("Team '" + newTeam.teamname + "' already exists.")
	}
	if (!newTeam.admin || !isText(newTeam.admin.name)) {
		throw new Error("New team 'admin.name' must be alphanumeric: " + newTeam.admin)
	}

	var teamIdAndRev = await teams.insert({
		teamname: newTeam.teamname,
		adminId: undefined                 // will be set later
	})
	var adminIdAndRev = await users.insert({
		teamId: teamIdAndRev.id,
		name: newTeam.admin.name,
		email: newTeam.admin.email
	})

	await teams.insert({ _id: teamIdAndRev.id, _rev: teamIdAndRev.rev, adminId: adminIdAndRev.id, foo: "bar" }).catch(err => logJ(err))

	let msg = "... new team created successfully: " + newTeam
	console.log(msg)
	return msg
}

/** 
 Get polls by their ID, optinally filtered by poll.status

 polls.list() returns an object with rows in it!

 { total_rows: 5,
  offset: 0,
  rows:
   [ { id: '_design/polls',
       key: '_design/polls',
       value: [Object],
       doc: [Object] },
		 { id: 'poll-1', key: 'poll-1', value: [Object], doc: [Object] },
		 
*/
let getPollsById = async function (status = undefined) {
	// get all Polls
	let pollsById = {}

	await polls.list({ include_docs: true }, {
		"include_docs": true
	}).then(res => {
		res.rows.forEach(row => {
			if (!row.id.startsWith("_design") && (status === undefined || row.doc.status === status)) {
				pollsById[row.id] = row.doc
				pollsById[row.id].proposals = []
			}
		})
	})

	/* alternative implementation. Filter with the view
	await polls.view('polls', 'byStatus', {"include_docs": true}).then(res => {
		res.rows.forEach(row => {
			if (status === undefined || row.key === status) {
				pollsById[row.id] = row.doc
				pollsById[row.id].proposals = []
			}
		})
	})
	*/

	// then sort the proposals into the polls by pollId
	await proposals.view('proposals', 'proposalsByPoll', {
		//key: "poll-1",																			// Here I could already filter only pollIds that match the status (if given)
		"include_docs": true																	// I don't need the docs here, becuase all info is already contained in the "value". Our map function above returns it like that.
	}).then(res => {
		res.rows.forEach(row => {
			if (row.key in pollsById) {													// row.key is the pollId
				pollsById[row.key].proposals.push(row.doc)
			}
		})
	})

	//console.log("========== Polls with Proposals")
	//console.log(JSON.stringify(pollsById, null, 2))

	return pollsById
}

//
// ===== Utility functions =====
//

var isAlphanumeric = function (str) {
	return str && str.match(/^[a-zA-Z0-9-_]+$/)
}
var isText = function (str) {  // space is allowed
	return str && str.match(/^[a-zA-Z0-9-_.,:;%$§ äöü]+$/)
}

var userExists = async function (id) {
	//console.log("Check if user exists", id)
	return users.head(id).then(data => {
		return data.statusCode === 200
	}).catch(err => {
		return false
	})
}

var teamExists = async function (teamname) {
	console.log("Checkfinf if team exists ", teamname)
	return await teams.view("teams", "byTeamname", {
		key: teamname
	}).then(data => {
		console.log("Team Exists data", data)
		return data.rows.length > 0
	}).catch(err => {
		console.log("Team exists err", err)
		console.log("Error cannot check if team exists", err)
		return false
	})
}

let logJ = function (json) {
	console.log(JSON.stringify(json, null, 4))
}

module.exports = {
	getPollsById: getPollsById,
	createNewTeam: createNewTeam,
}