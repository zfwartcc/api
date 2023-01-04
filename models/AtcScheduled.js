import zab from '../config/zab.js';
import m from 'mongoose';
import mlv from 'mongoose-lean-virtuals';

const atcScheduledSchema = new m.Schema({
	user: String,
	zuluTime: String,
	localTime: String,
	position: String,
	day: Date,

}, {
	collection: "scheduledATC"
});


atcScheduledSchema.plugin(mlv);

export default m.model('AtcScheduled', atcScheduledSchema);