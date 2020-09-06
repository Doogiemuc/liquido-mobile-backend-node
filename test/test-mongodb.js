/**
 * Basic tests for mongoDB and mongoose
 */
var assert = require('assert')
var config = require('../config.int.js')
var mongoDB = require('../liquido.mongoDB')
var LOG = require('loglevel').getLogger("mongoDB");
LOG.enableAll()    // Uncomment to enable all log levels (debug, trace, ...)

describe('LIQUIDO MOBILE MongoDB Tests', function () {
	describe('Happy Case - Test', function () {

		before("setup mongoDB", function () {
			LOG.info("Starting tests. PurgeDB")
			return mongoDB.connectToDB()
				.then(mongoDB.purgeDB)
		})

		after("disconnect from mongoDB", function () {
			return mongoDB.disconnectDB()
		})

		let team
		let poll

		it('Create a new team', function () {
			let now = Date.now()
			let teamName = 'teamFromTest ' + now
			let adminName = 'Admin Name_' + now
			let adminEmail = 'testuser' + now + '@liquido.me'
			return mongoDB.createTeam(teamName, adminName, adminEmail).then(createdTeam => {
				//console.log("Created new team", createdTeam)
				team = createdTeam
			})
		})

		/*

		it('Join existing team', async function () {
			assert.ok(team, "Need a team")
			assert.ok(team.inviteCode, "Need inviteCode")
			return mongoDB.joinTeam(team.inviteCode, "User Joined", "joinedUser@liquido.me").then(joinedTeam => {
				assert.ok(joinedTeam, "Expected a joined team")
			})
		})

		it('Create poll', function () {
			assert.ok(team, "Need a team")
			return mongoDB.createPoll(team._id, "Just a poll title").then(createdPoll => {
				assert.ok(createdPoll, "Expected a newly created poll")
			})
		})

		it('Add two proposals to poll', async function () {
			assert.ok(team, "Need a team")
			let polls = await mongoDB.getPollsOfTeam(team._id)
			assert.ok(polls.length > 0, "Need at least one poll to add proposal!")
			poll = polls[0]
			let users = await mongoDB.User.find().limit(2)
			assert.ok(users.length === 2, "Need at least two users to add proposals")

			return Promise.all(users.map(user => {
				return mongoDB.addProposalToPoll(poll._id, "Proposal by " + user.name, "Some Description", user._id)
			}))
		})

		it('Find and populate poll', async function () {
			poll = await mongoDB.Poll.findById(poll._id).populate('proposals').exec()
			//console.log("Populated poll\n\n", poll)
			assert.ok(poll)
			assert.ok(poll._id)
			assert.ok(poll.proposals[1]._id, "Poll should have at least two proposals")
		})

		it('Start voting phase', async function () {
			return mongoDB.startVotingPhase(poll._id)
		})

		it('Cast vote', async function () {
			let voteOrder = [poll.proposals[0]._id, poll.proposals[1]._id]
			//console.log("-------------- cast Vote, voteOrder:", voteOrder)
			return mongoDB.castVote(poll._id, voteOrder)
		})

		*/


	})
})
