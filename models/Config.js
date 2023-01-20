import { config } from 'dotenv';
import m from 'mongoose';

const configSchema = new m.Schema({
	id: String,
	lcConfig1: String, 
	lcConfig2: String, 
	lcConfig3: String, 
	lcConfig4: String, 
	gcConfig1: String,
	gcConfig2: String,
	gcConfig3: String,
	cdConfig1: String,
	cdConfig2: String,
}, {
	collection: "config"
});

export default m.model('Config', configSchema);