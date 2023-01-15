import zab from '../config/zab.js';
import m from 'mongoose';
import mlv from 'mongoose-lean-virtuals';

const ScheduledSessionSchema = new m.Schema({
	submitterCid: Number,
	startTime: Date,
	endTime: Date,
	position: String,
	facility: String

}, {
	collection: "scheduledSessions"
});

ScheduledSessionSchema.virtual('submitter', {
	ref: 'User',
	localField: 'submitterCid',
	foreignField: 'cid',
	justOne: true
});


ScheduledSessionSchema.plugin(mlv);

export default m.model('ScheduledSession', ScheduledSessionSchema);