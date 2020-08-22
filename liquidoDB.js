/**
 * Liquido Interface do CouchDB
 */
const DB_USER = "admin"
const DB_PASS = "admin"
const POLLS_DB_NAME = "polls"
const PROPOSALS_DB_NAME = "proposals"
const USERS_DB_NAME = "users"

const nano = require('nano')({
	url: 'http://' + DB_USER + ':' + DB_PASS + '@localhost:5984',
})
let polls = nano.use(POLLS_DB_NAME)
let proposals = nano.use(PROPOSALS_DB_NAME)
let users = nano.use(USERS_DB_NAME)

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

module.exports = {
	"getPollsById": getPollsById,

}