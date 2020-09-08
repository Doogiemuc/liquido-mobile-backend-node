/**
 * MongoDB Adapter for LIQUIDO node backend
 */
var config = require('./config.int.js')
var mongoose = require('mongoose');
var Schema = mongoose.Schema
var LOG = require('loglevel').getLogger("mongoDB");
LOG.enableAll()


/**
 * Mongoose models that will be exported
 */
let Team, Poll



/** 
 * Connect to the mongo database.
 * DO NOT FORGET to call this. Mongoose will NOT complain if you forget it!!!
 */
async function connectToDB() {
	LOG.info("Connecting to MongoDB as " + config.DB_USER + " at " + config.DB_HOST)

	// Need to use { dbName: ... }  https://stackoverflow.com/questions/48917591/fail-to-connect-mongoose-to-atlas
	try {
		await mongoose.connect(config.DB_URI, { dbName: config.DB_NAME, useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
	} catch (err) {
		LOG.error("Cannot connect to DB", err)
		throw err
	}

	const db = mongoose.connection;
	db.on('error', err => LOG.error("Mongoose connection error", err));

	await db.once('open', function () {
		LOG.debug(" ... [OK]\n")
	});
}

async function disconnectDB() {
	LOG.debug("Disconnecting from " + config.DB_HOST)
	return mongoose.disconnect()
}

/**
 * DELETE all collections in the current DB.   BE CAREFULL!!!
 */
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

function createMongoosSchemas() {
	LOG.debug("Creating mongoose schemas and models.")

	var teamSchema = new Schema(require('./schemas/team'), { timestamps: true })
	Team = mongoose.model('team', teamSchema)

	var pollSchema = new Schema(require('./schemas/poll'), { timestamps: false })
	Poll = mongoose.model('poll', pollSchema)
}





/** 
 * Create a new team with the team's admin.
 * The admin is the first member of the team.
 * @param {String|Object} teamName, adminName and adminEmail, either as three parameters or one JSON objecct
 * @return {Promise} saved team
 */
async function createNewTeam(teamName, adminName, adminEmail) {
	if (arguments.length === 1) {
		var { teamName, adminName, adminEmail } = arguments[0]
	}
	// sanity check
	if (!teamName) return Promise.reject("Need teamName")
	if (!adminName) return Promise.reject("Need adminName")
	if (!adminEmail) return Promise.reject("Need adminEmail")

	// Create Team with admin, inviteCode is automatically calculated.
	LOG.debug("createTeam(%s, %s, %s)", teamName, adminName, adminEmail)
	try {
		let savedTeam = await Team.create({ teamName: teamName, members: [{ name: adminName, email: adminEmail }] })
		LOG.info("New team created", JSON.stringify(savedTeam))
		return savedTeam
	} catch (err) {
		LOG.error("Could not create team '%s': %s", teamName, err)
		return Promise.reject(err)
	}
}

/** Get info about one specific team given by its teamname */
async function getTeam(teamName) {
	return Team.findOne({ teamName: teamName })
		.catch(err => {
			return Promise.reject("Cannot getTeam(" + teamName + "): " + err)
		})
}

/** New user wants to join an existing team. User will be created. */
async function joinTeam(inviteCode, username, userEmail) {
	if (arguments.length === 1) {
		var { inviteCode, username, userEmail } = arguments[0]
	}
	LOG.info("joinTeam(inviteCode=" + inviteCode + ")")
	let team = await Team.findOne({ inviteCode: inviteCode })
	if (!team) return Promise.reject("Cannot joinTeam: inviteCode " + inviteCode + " is invalid!")
	let newUser = { name: username, email: userEmail }
	team.members.push(newUser)
	return team.save()
}

async function createPoll(teamId, pollTitle) {
	if (!pollTitle) return Promise.reject("Cannot create Poll. Need pollTitle!")
	let team = await Team.findOne({ _id: teamId })
	if (!team) return Promise.reject("Cannot create Poll. Team(id=" + teamId + ") not found!")
	return Poll.create({ team: teamId, title: pollTitle, foo: "bar" }).then(createdPoll => {
		LOG.info("Created new poll ", JSON.stringify(createdPoll))
		return createdPoll
	})
}

async function getPollsOfTeam(teamId) {
	return Poll.find({ team: teamId }).exec()
}

async function addProposalToPoll(pollId, propTitle, propDescription, createdById) {
	LOG.debug("addProposalToPoll(pollId=%s, propTitle='%s', description='...', createdById=%s)", pollId, propTitle, createdById)
	let poll = await Poll.findOne({ _id: pollId })
	if (!poll) return Promise.reject("Cannot addProposalToPoll. Poll not found (poll._id=" + pollId + ")")
	if (poll.status !== "ELABORATION") return Promise.reject("Cannot addProposalToPoll. Poll(id=" + pollId + ") must be in status ELABORATION.")

	// user must not have a proposal in this poll yet!
	let userIds = poll.proposals.map(prop => prop.createdBy)
	if (userIds.includes(createdById)) return Promise.reject("Cannot addProposalToPoll. User(id=" + createdById + ") already has a proposal in poll(id=" + pollId + ")")

	poll.proposals.push({ title: propTitle, description: propDescription, createdBy: createdById })
	return poll.save().then(savedPoll => {
		LOG.info("Added proposal '" + propTitle + "' to poll(id=" + poll._id + ")")
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

// ================================================================================================
// Debugging and logging utilities   



// https://github.com/winstonjs/winston is a nice node JS logging lib.

/*
// Another alternative  could even be plain node.util logging. But doesn't support log everything "above" a given level.
var util = require('util')
const LOG = {
	debug: require('debug')('mongoDB:debug'),
	warn: require('debug')('mongoDB:warn'),
	info: require('debug')('mongoDB'),
	raw: require('debug')('mongoDB'),
}
LOG.raw.log = function (...args) {
	return process.stderr.write(util.format(...args));
}
*/



var originalFactory = LOG.methodFactory;
LOG.methodFactory = function (methodName, logLevel, loggerName) {
	var rawMethod = originalFactory(methodName, logLevel, loggerName)
	return function () {
		var prefix = "         "
		var messages = [prefix, '[' + loggerName + '.' + methodName.toUpperCase() + ']'];
		for (var i = 0; i < arguments.length; i++) {
			messages.push(arguments[i])
		}
		rawMethod.apply(undefined, messages)
	}
}


//
// ============== INIT =============
//
LOG.debug("Setting up LIQUIDO mongoDB")
createMongoosSchemas()


module.exports = {
	connectToDB: connectToDB,
	purgeDB: purgeDB,
	disconnectDB: disconnectDB,
	createMongoosSchemas: createMongoosSchemas,

	// Mongoose models that have the CRUD methods, e.g, .findOne(), .query(), ...
	Team: Team,
	Poll: Poll,

	// Use cases
	createNewTeam: createNewTeam,
	joinTeam: joinTeam,
	getTeam: getTeam,
	createPoll: createPoll,
	getPollsOfTeam: getPollsOfTeam,
	addProposalToPoll: addProposalToPoll,
	startVotingPhase: startVotingPhase,
	castVote: castVote,
	endVotingPhase: endVotingPhase,
}
