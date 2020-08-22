const liquidoDB = require('./liquidoDB')
const express = require('express')
const app = express()
const port = 3000



app.get('/', (req, res) => {
	res.send('This is the LIQUIDO mobile backend API  v.0.1')
})

app.get('/polls', async (req, res) => {
	let json = await liquidoDB.getPollsById()
	console.log(json)
	res.send(json)
})

app.listen(port, () => {
	console.log(`Liquido mobile backend listening at http://localhost:${port}`)
})