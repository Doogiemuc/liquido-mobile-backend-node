//
// Test Data
//


// just a dummy to create test data
let addDays = function (date, days) {
	let result = new Date(date)
	result.setDate(result.getDate() + days)
	return result
}

let logJ = function (json) {
	console.log(JSON.stringify(json, null, 4))
}

//
// ====================== USERS ====================
// 
let dummy_users = [
	{
		_id: "user-1",
		email: "user1@liquido.de",
		teamId: "team-1"
	}, {
		_id: "user-2",
		email: "user2@liquido.de",
		teamId: "team-1"
	}, {
		_id: "user-3",
		email: "user3@liquido.de",
		teamId: "team-1"
	},
]

//
// ====================== TEAMS ====================
// 
let dummy_teams = [
	{
		_id: "team-1",
		teamname: "TeamEins",
		admin: "user-1",
	},
	{
		_id: "team-2",
		teamname: "TeamZwei",
		admin: "user-2",
	}
]

//
// ====================== POLLS ====================
// 

let dummy_polls = [
	{
		_id: "poll-1",
		title: "Ich bin eine neue erstellte Abstimmung",
		status: "ELABORATION",
		votingStartAt: addDays(new Date(), 10),
		votingEndAt: addDays(new Date(), 20),
	},
	{
		_id: "poll-2",
		title: "Example poll in voting with a very long titela asddfasdf dd",
		status: "VOTING",
		votingStartAt: addDays(new Date(), -1),
		votingEndAt: addDays(new Date(), +9),
		winner: undefined,
		duelMatrix: undefined,
	},
	{
		_id: "poll-3",
		title: "Example poll in elaboration",
		status: "ELABORATION",
		votingStartAt: addDays(new Date(), -5),
		votingEndAt: addDays(new Date(), +9),
		winner: undefined,
		duelMatrix: undefined,
	},
	{
		_id: "poll-4",
		title: "Poll numbe four",
		status: "ELABORATION",
		votingStartAt: addDays(new Date(), -1),
		votingEndAt: addDays(new Date(), +9),
		winner: undefined,
		duelMatrix: undefined,
	},
]

//
// ====================== PROPOSALS ====================
// 

let dummy_proposals = [
	{
		_id: "proposal-1",
		pollId: "poll-1",
		title: "Proposal One qurg ASD asdfcvvef fdadsf ddd fff ddccc c ewe e",
		description: "Just an example proposal Bei relativ positionierten Elementen (position: relative) wird das Element aus seiner normalen Position im Elementfluss verschoben. Dabei gilt: Wenn die top Eigenschaft definiert wurde, überschreibt diese den Wert der bottom Eigenschaft. Wenn top den Wert auto besitzt, ist der berechnete Wert für bottom gleich dem Wert der top Eigenschaft mit umgedrehtem Vorzeichen. Wenn beide Eigenschaften nicht den Wert auto besitzen, wird bottom ignoriert und auf auto gesetzt.",
		status: "VOTING",
		createdAt: new Date(),
		updatedAt: new Date(),
		supporters: [],
		numSupporters: 15,
		supportedByCurrentUser: true,
		createdBy: "user-1"
	},
	{
		_id: "proposal-2",
		pollId: "poll-1",
		title: "Proposal Two",
		description: "Yet another example proposal xcvxclk c vd xc asdf cxvyxcv yxcv xycv ",
		status: "VOTING",
		createdAt: new Date(),
		updatedAt: new Date(),
		supporters: [],
		numSupporters: 9,
		supportedByCurrentUser: false,
		createdBy: "user-2"
	},
	{
		_id: "proposal-3",
		pollId: "poll-1",
		title: "Proposal Three with a very long title that will break more than three lines just to besure we make it very long",
		description: "Yet another example proposal xcvxclk c vd xc asdf cxvyxcv yxcv xycv ",
		status: "VOTING",
		createdAt: new Date(),
		updatedAt: new Date(),
		supporters: [],
		numSupporters: 92345,
		supportedByCurrentUser: true,
		createdBy: "user-3"
	},
]

//==================================================================================

const DB_USER = "admin"
const DB_PASS = "admin"

const TEAMS_DB_NAME = "teams"
const POLLS_DB_NAME = "polls"
const PROPOSALS_DB_NAME = "proposals"
const USERS_DB_NAME = "users"

let team, polls, proposals, users


const nano = require('nano')({
	url: 'http://' + DB_USER + ':' + DB_PASS + '@localhost:5984',
	// log: (id, args) => console.log("[NANO]", id, args)
})


async function recreateDBs() {
	await nano.db.destroy(TEAMS_DB_NAME).catch(err => { })
	await nano.db.create(TEAMS_DB_NAME)
	teams = nano.use(TEAMS_DB_NAME)

	await nano.db.destroy(POLLS_DB_NAME).catch(err => { })
	await nano.db.create(POLLS_DB_NAME)
	polls = nano.use(POLLS_DB_NAME)

	await nano.db.destroy(PROPOSALS_DB_NAME).catch(err => { })
	await nano.db.create(PROPOSALS_DB_NAME)
	proposals = nano.use(PROPOSALS_DB_NAME)

	await nano.db.destroy(USERS_DB_NAME).catch(err => { })
	await nano.db.create(USERS_DB_NAME)
	users = nano.use(USERS_DB_NAME)
}

async function seedUsers() {
	console.log("=== Seed " + USERS_DB_NAME)
	await users.bulk({ docs: dummy_users }).then(res => {
		console.log("    Created %s users", res.length)
	})
}

async function seedTeams() {
	console.log("=== Seed " + TEAMS_DB_NAME)
	/*
	await teams.bulk({ docs: dummy_teams }).then(res => {
		console.log("    Created %s teams", res.length)
	})
	*/

	await teams.insert({
		"views": {
			"byTeamname": {
				"map": function (doc) {
					emit(doc.teamname, { "_id": doc._id, "_rev": doc._rev })
				}
			}
		}
	}, "_design/" + TEAMS_DB_NAME)
}

async function seedProposals() {
	console.log("=== Seed " + PROPOSALS_DB_NAME)
	await proposals.bulk({ docs: dummy_proposals }).then(res => {
		console.log("    Created %s proposlas", res.length)
	})

	// Create a CouchDB "view" for proposals
	await proposals.insert(
		{
			"views": {
				"byStatus": {
					"map": function (doc) {
						emit(doc.status, { "_id": doc._id, "_rev": doc._rev })
					}
				},
				"proposalsByPoll": {
					"map": function (doc) {
						emit(doc.pollId, {
							/* one shall not put a copy of the doc into the view, because then it keeps a full copy of the db */
							"_id": doc._id,
							"_rev": doc._rev
						})
					}
				}
			},
		}, "_design/proposals")
		.then(res => console.log("    Created CouchDB views"))

}

async function seedPolls() {
	console.log("=== Seed Polls")

	//Bulk insert poll documents
	await polls.bulk({ docs: dummy_polls }).then(res => {
		console.log("    Created %s polls", res.length)
	})

	// Create a CouchDB "view" for polls
	await polls.insert(
		{
			"views": {
				"byStatus": {
					"map": function (doc) {
						emit(doc.status, {
							"_id": doc._id,
							"_rev": doc._rev,
						})
						/*
							"title": doc.title,
							"status": doc.status,
							"votingStartAt": doc.votingStartAt,
							"votingEndAt": doc.votingEndAt
						})
						*/
					}
				},
			},
		}, "_design/polls")
		.then(res => console.log("    Created CouchDB views"))

}

console.log("======== Recreate data in TEST DB ==========")
async function seedTestData() {
	await recreateDBs()
	await seedUsers()
	await seedTeams()
	await seedPolls()
	await seedProposals()

	/*
	await polls.view('polls', 'byStatus', {
		key: "ELABORATION",
		"include_docs": true
	}).then(res => {
		console.log("Restult polls WHERE Status == ELABORATION")
		res.rows.forEach(doc => console.log(doc))
		//console.log(JSON.stringify(res, null, 2))
	})
	*/
	/*
	await proposals.view('proposals', 'proposalsByPoll', {
		key: "poll-1",
		//"include_docs": true
	}).then(res => {
		console.log("Proposals in poll-1")
		//console.log(res)
		res.rows.forEach(row => console.log(row))
		//console.log(JSON.stringify(res, null, 2))
	}).catch(err => {
		console.log(err)
	})
	*/
}

// ======================


seedTestData()
	.catch(err => console.log(err))
