/**
 * Basic tests for mongoDB and mongoose
 */
var assert = require('assert')
var config = require('../config.int.js')
var mongoDB = require('../liquido.mongoDB');
const { createPoll } = require('../liquido.mongoDB');
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
			console.log(" ")
			return mongoDB.disconnectDB()
		})

		beforeEach(function () {
			console.log("\n\n------------------------", this.currentTest.title, "----------------------")
		})

		// Global vars for use in each test case
		let team
		let teamName
		let poll

		it('Create a new team', function () {
			let now = Date.now()
			teamName = 'teamFromTest ' + now
			let adminName = 'Admin Name_' + now
			let adminEmail = 'admin' + now + '@liquido.me'
			return mongoDB.createTeam(teamName, adminName, adminEmail).then(createdTeam => {
				assert.ok(createdTeam.inviteCode)
				assert.equal(createdTeam.inviteCode.length, 6, "team.inviteCode should be 6 characters long")
				team = createdTeam
			})
		})

		it('Join existing team', async function () {
			assert.ok(team, "Need a team")
			assert.ok(team.inviteCode, "Need inviteCode")
			let now = Date.now()
			let userName = 'User Name_' + now
			let userEmail = 'user' + now + '@liquido.me'
			return mongoDB.joinTeam(team.inviteCode, userName, userEmail).then(joinedTeam => {
				assert.ok(joinedTeam, "Expected a joined team")
				assert.ok(joinedTeam.members.find(member => member.email === userEmail), "userEmail should be member of team")
				team = joinedTeam
			})
		})

		it('Create poll', async function () {
			assert.ok(team, "Need a team")
			let pollTitle = "Just a poll title"
			return mongoDB.createPoll(team._id, pollTitle).then(createdPoll => {
				assert.ok(createdPoll, "Expected a newly created poll")
				assert.equal(createdPoll.title, pollTitle)
			})
		})

		it('Add two proposals to poll', async function () {
			assert.ok(team, "Need a team")
			assert.ok(team.members.length >= 2, "Need at least two users in the team")
			let polls = await mongoDB.getPollsOfTeam(team._id)
			assert.ok(polls.length > 0, "Need at least one poll to add proposal!")
			poll = polls[0]  // Store for later use in next test steps

			return Promise.all([
				mongoDB.addProposalToPoll(polls[0]._id, "Proposal by " + team.members[0].name, "Some description  ", team.members[0]._id),
				mongoDB.addProposalToPoll(polls[0]._id, "Proposal by " + team.members[1].name, "Second description", team.members[1]._id)
			])
		})

		it('Find poll and populate team', async function () {
			poll = await mongoDB.Poll.findById(poll._id).populate('team').exec()
			//LOG.debug("Populated poll\n\n", poll)
			assert.ok(poll)
			assert.ok(poll._id)
			assert.equal(poll.team.teamname, teamName)
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

	})
})
