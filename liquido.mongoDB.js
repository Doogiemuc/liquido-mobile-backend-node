var config = require('./config.int.js')
var mongoose = require('mongoose');
const { json } = require('express');
var Schema = mongoose.Schema

// Mongoose models
var User, Team, Poll, Proposal

/** Connect to the mongo database. */
async function connectToDB() {
	console.log("Connecting to MongoDB ", config.DB_URI)

	// Need to use { dbName: ... }  https://stackoverflow.com/questions/48917591/fail-to-connect-mongoose-to-atlas
	mongoose.connect(config.DB_URI, { dbName: config.DB_NAME, useNewUrlParser: true, useUnifiedTopology: true })

	const db = mongoose.connection;
	db.on('error', console.error.bind(console, 'MongoDB connection error:'));
	/*
	await db.once('open', function () {
		console.log("  ... connected successfully.")
	});
	*/
}

/** Create the mongoose schemas (Entity Classes) */
async function createMongoosSchemas() {

	var teamSchema = new Schema({
		teamname: {
			type: String,
			required: "Teamname is required",
			unique: true
		},
		admin: {
			type: Schema.Types.ObjectId,
			ref: 'liquido-user'
		},
		inviteCode: {
			type: String,
			required: "Team needs an inviteCode",
			unique: true
		},
		members: [{
			type: Schema.Types.ObjectId,
			ref: 'liquido-user'
		}]
	})

	var userSchema = new Schema({
		name: {
			type: String,
			trim: true,
			required: "User name is required",
		},
		email: {
			type: String,
			trim: true,
			lowercase: true,
			// unique: true,   //TODO: can one email be the admin of several teams?
			required: 'Email address is required',
			//validate: [validateEmail, 'Please fill a valid email address'],
			match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
		}
	})

	var pollSchema = new Schema({
		team: {
			type: Schema.Types.ObjectId,
			ref: 'team',
			required: true
		},
		title: {
			type: String,
			trim: true,
			required: "Poll title is required",
		},
		status: {
			type: String,
			required: true,
			default: "ELABORATION"
		},
		proposals: [{
			type: Schema.Types.ObjectId,
			ref: 'proposal'
		}],
		winner: {
			type: Schema.Types.ObjectId,
			ref: 'proposal',
			required: false,
			default: undefined
		},
		ballots: [{
			voteOrder: [{
				type: Schema.Types.ObjectId,
				ref: 'proposal',
			}]
		}],
		createdAt: {
			type: Date,
			default: Date.now
		},
		votingStartedAt: {
			type: Date
		}
	})

	var proposalSchema = new Schema({
		title: {
			type: String,
			trim: true,
			unique: true,
			required: "Proposal title is required",
		},
		description: {
			type: String,
			trim: true,
			required: "Proposal description is required",
		},
		//TODO: supporters
		//MAYBE: pollId ?
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'liquido-user',
			required: true
		},
		createdAt: {
			type: Date,
			default: Date.now
		},
	})

	/*
	var ballotSchema = new Schema({
		//rightToVote: ...
		voteOrder: {
			type: Array,
			default: []
		}
	})
	*/

	Team = mongoose.model('team', teamSchema)
	User = mongoose.model('liquido-user', userSchema)
	Poll = mongoose.model('poll', pollSchema)
	Proposal = mongoose.model('proposal', proposalSchema)
	//Ballot = mongoose.model('ballot', ballotSchema)
}

/** Create a new team with an admin */
async function createTeam(teamName, adminName, adminEmail) {
	LOG.debug("createTeam", teamName, adminName, adminEmail)

	// 0. sanity check
	if (!teamName) return Promise.reject("Need teamName")
	if (!adminName) return Promise.reject("Need adminName")
	if (!adminEmail) return Promise.reject("Need adminEmail")

	// 1. check if admin user already exists 
	let adminQuery = User.where({ email: adminEmail })
	let admin = await adminQuery.findOne()
	if (!admin) admin = new User({ name: adminName, email: adminEmail })

	// 2. Create and save the new Team. Link admin user into team.
	let inviteCode = Math.floor(Math.random() * 0xFFFFFF).toString(16);
	let team = new Team({ teamname: teamName, inviteCode: inviteCode })
	try {
		let savedAdmin = await admin.save()
		team.admin = savedAdmin._id
		return await team.save()
	} catch (err) {
		if (err.name === 'MongoError' && err.code === 11000) {
			return Promise.reject({ err: "Cannot createTeam, duplicate key", keyValue: err.keyValue })
		}
		return Promise.reject(err)
	}
}

/** Get info about one specific team given by its teamname */
async function getTeam(teamname) {
	return Team
		.findOne({ teamname: teamname })
		.populate('admin')
		.populate('members')
		.exec()
		.catch(err => {
			return Promise.reject("Cannot getTeam(" + teamname + "): " + err)
		})
}

/** New user wants to join an existing team. User will be created. */
async function joinTeam(inviteCode, username, userEmail) {
	LOG.debug("joinTeam222 invite=" + inviteCode)
	let team = await Team.findOne({ inviteCode: inviteCode })
	console.log("(2)")
	if (!team) return Promise.reject("Cannot find this inviteCode")
	let user = new User({ name: username, email: userEmail })
	await user.save()
	team.members.push(user)
	return team.save()
}

async function createPoll(teamId, pollTitle) {
	let team = await Team.findOne({ _id: teamId })
	if (!team) return Promise.reject("Cannot create Poll. Team not found (team._id=" + teamId + ")")
	let poll = new Poll({ title: pollTitle, team: team._id })
	await poll.save()
	LOG.debug("Created new poll ", poll)
	return Promise.resolve(poll)
}

async function getPollsOfTeam(teamId) {
	return Poll.find({ team: teamId }).exec()
}

async function addProposalToPoll(pollId, propTitle, propDescription, createdById) {
	let poll = await Poll.findOne({ _id: pollId })
	if (!poll) return Promise.reject("Cannot addProposalToPoll. Poll not found (poll._id=" + pollId + ")")
	if (poll.status !== "ELABORATION") return Promise.reject("Cannot addProposalToPoll. Poll must be in status ELABORATION.")

	//TODO: user must not have a proposal in this poll yet!

	let prop = new Proposal({
		title: propTitle,
		description: propDescription,
		createdBy: createdById,
	})
	await prop.save()
	poll.proposals.push(prop)
	LOG.debug("Added proposal to poll(id=" + poll._id + ")")
	return poll.save()
}

async function startVotingPhase(pollId) {
	let poll = await Poll.findOne({ _id: pollId })
	if (!poll) return Promise.reject("Cannot startVotingPhase. Poll not found (poll._id=" + pollId + ")")
	if (poll.status !== "ELABORATION") return Promise.reject("Cannot startVotingPhase. Poll must be in status ELABORATION.")
	if (poll.proposals.length < 2) return Promise.reject("Cannot startVotingPhase. Poll must have at least two proposals.")
	poll.status = "VOTING"
	poll.votingStartedAt = Date.now()
	LOG.debug("startVotingPhase of poll.id=" + pollId)
	return poll.save()
}

async function castVote(pollId, voteOrder) {
	let poll = await Poll.findOne({ _id: pollId })
	if (!poll) return Promise.reject("Cannot castVote. Poll not found (poll._id=" + pollId + ")")
	if (poll.status !== "VOTING") return Promise.reject("Cannot castVote. Poll must be in status VOTING.")
	if (!voteOrder || !voteOrder[0]) return Promise.reject("Cannot castVote. Need Array voteOrder.")
	poll.ballots.push({ voteOrder: voteOrder })
	LOG.debug("castVote in poll.id=" + pollId)
	return poll.save()
}

async function endVotingPhase(pollId) {
	let poll = await Poll.findOne({ _id: pollId })
	if (!poll) return Promise.reject("Cannot endVotingPhase. Poll not found (poll._id=" + pollId + ")")
	if (poll.status !== "VOTING") return Promise.reject("Cannot startVotingPhase. Poll must be in status VOTING.")
	poll.status = "FINISHED"
	poll.votingEndAt = Date.now

	//TODO: calc winner

	LOG.debug("endVotingPhase of poll.id=" + pollId)
	return poll.save()
}

//
// Debugging and logging utilities   
//MAYBE: USe https://github.com/winstonjs/winston for logging
//
const LOG_ALL = 99
const ERROR = 3
const INFO = 2
const DEBUG = 1
let LOG = {
	level: LOG_ALL,
	error: function (...args) {
		if (this.level >= ERROR) console.log("[ERROR]", args.join(" "))
	},
	info: function (...args) {
		if (this.level >= INFO) console.log("[INFO]", args.join(" "))
	},
	debug: function (...args) {
		if (this.level >= DEBUG) console.log("[DEBUG]", args.join(" "))
	},
	raw(msg) {
		process.stdout.write(msg)
	},
	json(json) {
		console.log(JSON.stringify(json, null, 4))
	}
}





const ttt = "team-" + Date.now()

async function doStuff() {
	try {


		let createdTeam = await createTeam(ttt, "Admin Name", ttt + "@liquido.me")

		LOG.info("join team:")
		let joinedTeam = await joinTeam(createdTeam.inviteCode, "User Joined", "asdfads@asdfasd.de")
		LOG.info("---------- joined Team\n", joinedTeam)

		let createdPoll = await createPoll(joinedTeam._id, "Just a poll title")
		LOG.info("---------- Created Poll")
		LOG.json(createdPoll)

		let fetchedTeam = await getTeam(ttt)
		LOG.info("---------- fetched Team\n", fetchedTeam)

		let polls = await getPollsOfTeam(joinedTeam._id)
		LOG.debug("--------------- Received Polls of Team\n", polls)

		let auser = await User.findOne()

		let poll
		poll = await addProposalToPoll(polls[0]._id, "Proposal Title " + Date.now(), "This is a very long description", auser._id)
		poll = await addProposalToPoll(polls[0]._id, "Proposal Zwei  " + Date.now(), "This is a very lonasfdaf a df g description", auser._id)
		LOG.debug("--------------- Poll as returned\n", poll)

		let ppp = await Poll.findById(poll._id).populate('proposals').exec()
		LOG.debug("--------------- ppp when loaded and populated\n", ppp)

		await startVotingPhase(poll._id)

		let voteOrder = [poll.proposals[0]._id, poll.proposals[1]._id]
		LOG.debug("-------------- cast Vote, voteOrder:", voteOrder)
		await castVote(poll._id, voteOrder)

		await endVotingPhase(poll._id)

	} catch (e) {
		LOG.error("=== FATAL ===")
		LOG.json(e)
	}
}

LOG.info("Starting Liquido Backend Service ...")
connectToDB()
	.then(createMongoosSchemas)
	.then(doStuff)



/*
const MongoClient = require('mongodb').MongoClient;
const client = new MongoClient( { useNewUrlParser: true, useUnifiedTopology: true }, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect(err => {
	const collection = client.db("test").collection("devices");
	// perform actions on the collection object

	console.log("Connected to DB")

	client.close();
});
*/
