import zab from '../config/zab.js';
import m from 'mongoose';
import mlv from 'mongoose-lean-virtuals';

const ScheduledSessionSchema = new m.Schema({
	submitterCid: Number,
	startTime: Date,
	endTime: Date,
	position: {
		name: String,
		id: String,
	},
	facility: String,
	positionName: String

}, {
	collection: "scheduledSessions"
});

ScheduledSessionSchema.virtual('submitter', {
	ref: 'User',
	localField: 'submitterCid',
	foreignField: 'cid',
	justOne: true
});

ScheduledSessionSchema.virtual('facility2', {
	ref: 'AtcPosition',
	localField: 'facility',
	foreignField: 'code',
	justOne: true
});


ScheduledSessionSchema.plugin(mlv);

export default m.model('ScheduledSession', ScheduledSessionSchema);