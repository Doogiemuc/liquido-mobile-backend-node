console.log("Starting liquido mobile backend ...")

const liquidoDB = require('./liquidoDB')
const express = require('express')
const app = express()
const port = 3000
app.use(express.json());

app.get('/', (req, res) => {
	res.send('This is the LIQUIDO mobile backend API  v.0.1')
})

/**
 * Create a new Team 
 * Returns 
 *  - HTTP 201 Created on success
 *  - HTTP 409 Conflict when this teamname already exists
 *  - HTTP 500 on error
 */
app.post('/createTeam', (req, res) => {
	let newTeam = req.body
	liquidoDB
		.createNewTeam(newTeam)
		.then(createdTeam => {
			res.status(201).send("New Team created successfully.")
		})
		.catch(err => {
			console.log("ERROR! Cannot create Team:", err.message)
			res.status(400).send(err.message);
		});
})

/** 
 * Join an existing team 
 * Returns HTTP 200 on success
 */

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