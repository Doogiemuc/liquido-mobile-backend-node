/**
 * Liquido Mobile HTTP REST API Tests
 */
var assert = require('assert')
var config = require('../config.'+process.env.NODE_ENV+'.js')
var mongoDB = require('../liquido.mongoDB');
var LOG = require('loglevel').getLogger("mongoDB");
//LOG.enableAll()    // Uncomment to enable all log levels (debug, trace, ...)

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
			if (LOG.getLevel() <= LOG.levels.DEBUG) {
				console.log("\n\n------------------------", this.currentTest.title, "----------------------")
			}
		})

		// Global vars for use in each test case
		let team
		let poll

		it('Create a new team', async function () {
			let now = Date.now()
			var newTeam = {
				teamName: 'teamFromTest ' + now,
				adminName: 'Admin Name_' + now,
				adminEmail: 'admin' + now + '@liquido.me'
			}
			return mongoDB.createTeam(newTeam).then(createdTeam => {
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
				poll = createdPoll
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
			return mongoDB.Poll.findById(poll._id).populate('team').then(p => {
				//LOG.debug("Populated poll\n\n", poll)
				assert.ok(p._id)
				assert.equal(p.team.teamName, team.teamName, "Team should have same teamname")
				assert.ok(p.proposals[1]._id, "Poll should have at least two proposals")
				poll = p
			})
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
