const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => {
	res.send('This is the LIQUIDO mobile backend API  v.0.1')
})

app.get('/polls', (req, res) => {

})

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})