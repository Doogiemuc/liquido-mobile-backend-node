/**
 * MongoDB Adapter for LIQUIDO node backend
 */
var config = require('./config.int.js')
var mongoose = require('mongoose');
var Schema = mongoose.Schema

// Mongoose models
let User, Team, Poll, Proposal

/** Connect to the mongo database. */
async function connectToDB() {
	LOG.info("Connecting to MongoDB as " + config.DB_USER + " at " + config.DB_HOST)

	// Need to use { dbName: ... }  https://stackoverflow.com/questions/48917591/fail-to-connect-mongoose-to-atlas
	await mongoose.connect(config.DB_URI, { dbName: config.DB_NAME, useNewUrlParser: true, useUnifiedTopology: true })

	const db = mongoose.connection;
	db.on('error', console.error.bind(console, 'MongoDB connection error:'));

	await db.once('open', function () {
		LOG.debug(" ... [OK]\n")
	});
}

async function disconnectDB() {
	LOG.debug("Disconnecting from " + config.DB_HOST)
	return mongoose.disconnect()
}

async function purgeDB() {
	return mongoose.connection.db.listCollections().toArray().then(collections => {
		if (!collections) return Promise.resolve("Nothing to remove")
		let tasks = collections.map(col => {
			LOG.debug("DROPPING collection:", col.name)
			return mongoose.connection.db.dropCollection(col.name)
		})
		return Promise.all(tasks)
	})

	/*
	await mongoose.connection.db.dropDatabase(function (err, result) {
		console.log("DROPPPED database!")
	});
	*/
}

/** Create the mongoose schemas (Entity Classes) */
function createMongoosSchemas() {
	LOG.debug("Creating mongoose schemas")
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
		votingStartAt: {
			type: Date
		},
		votingEndAt: {
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
		poll: {
			type: Schema.Types.ObjectId,
			ref: 'poll',
			required: true
		},
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
		voteOrder: [{
			type: Schema.Types.ObjectId,
			ref: 'proposal',
		}]
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
	LOG.debug("createTeam(%s, %s, %s)", teamName, adminName, adminEmail)

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
	LOG.info("joinTeam(inviteCode=" + inviteCode + ")")
	let team = await Team.findOne({ inviteCode: inviteCode })
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
	LOG.info("Created new poll ", poll)
	return Promise.resolve(poll)
}

async function getPollsOfTeam(teamId) {
	return Poll.find({ team: teamId }).exec()
}

async function addProposalToPoll(pollId, propTitle, propDescription, createdById) {
	LOG.debug("addProposalToPoll(pollId=%s, propTitle='%s', description='...', createdById=%s)", pollId, propTitle, createdById)
	let poll = await Poll.findOne({ _id: pollId }).populate('proposals')
	if (!poll) return Promise.reject("Cannot addProposalToPoll. Poll not found (poll._id=" + pollId + ")")
	if (poll.status !== "ELABORATION") return Promise.reject("Cannot addProposalToPoll. Poll(id=" + pollId + ") must be in status ELABORATION.")
	// user must not have a proposal in this poll yet!
	let userIds = poll.proposals.map(prop => prop.createdBy)
	if (userIds.includes(createdById)) return Promise.reject("Cannot addProposalToPoll. User(id=" + createdById + ") already has a proposal in poll(id=" + pollId + ")")

	let prop = new Proposal({
		title: propTitle,
		description: propDescription,
		createdBy: createdById,
		poll: pollId,
	})
	await prop.save()
	poll.proposals.push(prop)
	return poll.save().then(savedPoll => {
		LOG.info("Added proposal to poll(id=" + poll._id + ")")
		return savedPoll
	})
}

async function startVotingPhase(pollId) {
	let poll = await Poll.findOne({ _id: pollId })
	if (!poll) return Promise.reject("Cannot startVotingPhase. Poll(id=" + pollId + ") not found.")
	if (poll.status !== "ELABORATION") return Promise.reject("Cannot startVotingPhase. Poll(id=" + pollId + ") must be in status ELABORATION.")
	if (poll.proposals.length < 2) return Promise.reject("Cannot startVotingPhase. Poll(id=" + pollId + ") must have at least two proposals.")
	poll.status = "VOTING"
	poll.votingStartAt = Date.now()
	LOG.debug("startVotingPhase of poll.id=" + pollId)
	return poll.save()
}

async function castVote(pollId, voteOrder) {
	let poll = await Poll.findOne({ _id: pollId })
	if (!poll) return Promise.reject("Cannot castVote. Poll not found (poll._id=" + pollId + ")")
	if (poll.status !== "VOTING") return Promise.reject("Cannot castVote. Poll must be in status VOTING.")
	if (!voteOrder || !voteOrder[0]) return Promise.reject("Cannot castVote. Need Array voteOrder.")

	//TOOD: check rightToVote

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
//MAYBE: Use https://github.com/winstonjs/winston for logging but currently this little goody is all I need
const LOG = {
	debug: require('debug')('mongoDB:debug'),
	warn: require('debug')('mongoDB:warn'),
	info: require('debug')('mongoDB')
}


/*
const ttt = "team-4711"

async function runUnitTests() {
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

connectToDB()
	.then(purgeDB)
	.then(createMongoosSchemas)
	.then(runUnitTests)

*/

LOG.debug("Setting up LIQUIDO mongoDB")
createMongoosSchemas()


module.exports = {
	connectToDB: connectToDB,
	purgeDB: purgeDB,
	disconnectDB: disconnectDB,
	createMongoosSchemas: createMongoosSchemas,

	// Mongoose models (e.g. with .findOne(), query() ... methods)
	User: User,
	Team: Team,
	Poll: Poll,
	Proposal: Team,
	//Ballot: Ballot,

	// Use cases
	createTeam: createTeam,
	joinTeam: joinTeam,
	getTeam: getTeam,
	createPoll: createPoll,
	getPollsOfTeam: getPollsOfTeam,
	addProposalToPoll: addProposalToPoll,
	startVotingPhase: startVotingPhase,
	castVote: castVote,
	endVotingPhase: endVotingPhase,
}
