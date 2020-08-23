var config = require('./config.int.js')
var mongoose = require('mongoose');
var Schema = mongoose.Schema;


// Mongoose models
var User, Team

async function connectToDB() {
	console.log("Connecting to MongoDB ", config.DB_URI)
	mongoose.connect(config.DB_URI, { dbName: config.DB_NAME, useNewUrlParser: true, useUnifiedTopology: true })

	// Need to use dbName  https://stackoverflow.com/questions/48917591/fail-to-connect-mongoose-to-atlas
	/*
	const db = mongoose.connection;
	db.on('error', console.error.bind(console, 'MongoDB connection error:'));
	await db.once('open', function () {
		console.log("  ... connected successfully.")
	});
	*/
}

async function createMongoosSchema() {
	console.log("createMongooseSchema")
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
			match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill in a valid email address'],
		}
	})

	Team = mongoose.model('team', teamSchema);
	User = mongoose.model('liquido-user', userSchema);

}

/** save returns a promise */
async function createTeam(teamJson) {
	console.log("createTeam", teamJson)
	let team = new Team({ teamname: teamJson.teamname })
	let admin = new User({ name: teamJson.admin.name, email: teamJson.admin.email })
	try {
		let savedTeam = await team.save()
		let savedAdmin = await admin.save()
		savedTeam.admin = savedAdmin._id			// Link admin into team
		return await savedTeam.save()
	} catch (err) {
		if (err.name === 'MongoError' && err.code === 11000) {
			return Promise.reject({ err: "Duplicate key", keyValue: err.keyValue })
		}
		return Promise.reject(err)
	}


	/*
	return team.save()
		.then(savedTeam => {
			console.log("SavedTeam", savedTeam)
			let admin = new User({ name: teamJson.admin.name, email: teamJson.admin.email })
			return admin.save().then(savedAdmin => {
				console.log("savedAdmin", savedAdmin)
				savedTeam.admin = savedAdmin._id
				return savedTeam.save().then(teamWithAdmin => {
					console.log("Saved teamWithAdmin: ", teamWithAdmin)
					return teamWithAdmin
				})
			})
		})
		.catch(err => {
			if (err.code == 11000) throw "Duplicate " + JSON.stringify(err.keyValue)
			else throw "Cannot create team: " + err
		})
	*/
}

let logJ = function (json) {
	console.log(JSON.stringify(json, null, 4))
}

const teamname = "team19"

async function doStuff() {
	console.log("... doStuff ...")


	try {
		let teamReturned = await createTeam({ teamname: teamname, admin: { name: "Admin Name", email: teamname + "@liquido.me" } })
		console.log("function call returned ", teamReturned)
	} catch (e) {
		console.log("Cannot createTeam Error", e)
		return
	}


	Team.
		findOne({ teamname: teamname }).
		populate('admin').
		exec(function (err, teamTT) {
			if (err) console.log("ERROR populate:", err)
			else console.log('Received Team', teamTT);
		})

}

connectToDB()
	.then(createMongoosSchema)
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
