var mongoose = require('mongoose');
var Schema = mongoose.Schema

/**
 * Mongoose Schema for a Poll with its proposals and also casted ballots
 */
module.exports = {

	// Mongoose reference to the team
	team: {
		type: Schema.Types.ObjectId,
		ref: 'team',
		required: true
	},

	// Title of this poll
	title: {
		type: String,
		trim: true,
		required: "Poll title is required",
	},

	// Poll status
	status: {
		type: String,
		required: true,
		match: [/^ELABORATION|VOTING|FINISHED$/, 'Poll.status must be one of ELABORATION|VOTING|FINISHED'],
		default: "ELABORATION"
	},

	// The proposals in this poll
	proposals: [
		{
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
			numSupporters: {
				type: Number,
				default: 0
			},
			createdBy: {
				type: Schema.Types.ObjectId,
				//ref: 'liquido-user',
				required: true
			},
			createdAt: {
				type: Date,
				default: Date.now
			},
		}
	],

	// All casted ballots. Each with a voteOrder and a right2Vote hashed token
	ballots: [{
		voteOrder: [Schema.Types.ObjectId],
		right2Vote: String
	}],

	// Winner of this poll when status === FINISHED
	winner: {
		type: Schema.Types.ObjectId,  		// Proposal ID in proposals array
		required: false,
		default: undefined
	},

	// Start and end of voting phase. Can be triggered by admin.
	votingStartAt: {
		type: Date,
		default: undefined
	},
	votingEndAt: {
		type: Date,
		default: undefined
	}

	// createdAt, updatedAt will automatically be added by Mongoose


}