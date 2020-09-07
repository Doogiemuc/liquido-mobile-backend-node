console.log("Starting liquido mobile backend ...")

const liquidoDB = require('./liquido.mongoDB')
const LOG = require('loglevel').getLogger("liquidoAPI");
const express = require('express')
const cors = require('cors')
const app = express()
const port = 3000
app.use(express.json())
app.use(cors())								// Enable CORS allow-all-origins 
app.use(logHttpErrors)				// these must be last!
app.use(generalErrorHandler)




//** Connect to DB */
liquidoDB.connectToDB()



/** log HTTP requests */
function logHttpErrors(err, req, res, next) {
	console.error("[express]", err)
	next(err)
}

/** express error handler */
function generalErrorHandler(err, req, res, next) {
	/*
	if (res.headersSent) {
		return next(err)
	}
	*/
	res.status(500).send({
		err: err,
		message: "Liquido error"
	})
}


/**
 * This is the LIQUIDO Mobile HTTP API.
 */
app.get('/', (req, res) => {
	res.send('This is the LIQUIDO mobile backend API  v.0.1')
})

//TODO: log every incomign request
//TODO: central error handling with clean JSON error response including message
//TODO: documentation in swagger.yaml


/**
 * Create a new Team
 * POST request body:
 *   
 *   {
 *     teamName: String,      // Name of your team. (Param name is camelCase!)
 *     adminName: String,     // Name of team's admin. Required.
 *     adminEmail: EMail      // E-Mail of team's admin. Required.
 *   }
 * 
 * Returns 
 *  - HTTP 201 Created on success
 *  - HTTP 409 Conflict when this teamname already exists
 *  - HTTP 500 on error
 */
app.post('/createTeam', async (req, res, next) => {
	//TODO: create the mongoose model here and let mongoose do the validation?   let team = new Team(req.body) ?
	//Implementation note: https://expressjs.com/en/guide/error-handling.html  Starting with Express 5, route handlers and middleware that return a Promise will call next(value) automatically when they reject or throw an error. 
	let newTeam = {
		teamName: req.body.teamName,
		members: [{
			name: req.body.adminName,
			email: req.body.adminEmail
		}]
	}
	let createdTeam = await liquidoDB.Team.create(newTeam)
	//liquidoDB.createNewTeam(req.body)
	res.status(201).send({
		inviteCode: createdTeam.inviteCode,
		message: "New team created successfully."
	})
})

/** 
 * Join an existing team 
 * PUT request body:
 * { inviteCode, username, userEmail }
 * PUT is idempotent! Calling this muliple times is the same as calling it once.
 */
app.put('/joinTeam', (req, res) => {
	liquidoDB
		.joinTeam(req.body)
		.then(joinedTeam => {
			res.status(200).send({
				teamName: joinTeam.teamName,
				message: "You joined this team successfully."
			})
		})
		.catch(err => {
			LOG.error("Cannot join Team:", err.message)
			res.status(400).send(err.message);
		});
})



/** Get all polls of this team (including the proposals in each poll). */
app.get('/polls', async (req, res) => {
	let polls = await liquidoDB.getPollsById()
	res.json(polls)
})

/** Get one poll by its ID */
app.get('/polls/:id', async (req, res) => {
	let poll = await liquidoDB.getPollById(req.params.id)
	res.json(poll)
})

/** Start ExpressJS backend server */
app.listen(port, () => {
	console.log(`Liquido mobile backend listening at http://localhost:${port}`)
})