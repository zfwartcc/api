import zab from '../config/zab.js';
import m from 'mongoose';
import mlv from 'mongoose-lean-virtuals';

const AtcPositionSchema = new m.Schema({
	code: String,
	name: String,
	positions: [{ 
	name: String,
	id: String,
    certCode: String
    }]
}, {
	collection: "atcPositions"
});




AtcPositionSchema.plugin(mlv);

export default m.model('AtcPosition', AtcPositionSchema);