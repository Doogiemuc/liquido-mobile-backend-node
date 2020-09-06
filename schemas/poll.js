var mongoose = require('mongoose');
var Schema = mongoose.Schema

/**
 * Mongoose Schema for a Poll with its proposals and also casted ballots
 */
export default {
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

	createdAt: {
		type: Date,
		default: Date.now
	},
	votingStartAt: {
		type: Date,
		default: undefined
	},
	votingEndAt: {
		type: Date,
		default: undefined
	}
}