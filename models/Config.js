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
	gcConfig3: String,
	cdConfig1: String,
	cdConfig2: String,
	afldConfig1: String,
	afldConfig2: String,
	afldConfig3: String,
	afldConfig4: String,
	deprwyConfig1: String,
	deprwyConfig2: String,
	arrrwyConfig1: String,
	arrrwyConfig2: String,
	apptype1: String,
	apptype2: String,
}, {
	collection: "config"
});

export default m.model('Config', configSchema);