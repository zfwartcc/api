import nodemailer from 'nodemailer';
import neh from 'nodemailer-express-handlebars';
import path from 'path';

const __dirname = path.resolve();

const transport = nodemailer.createTransport({
	host: "smtp.zoho.com",
	port: 587,
	secure: false,
	requireTLS: true,
	auth: {
		user: 'no-reply@zauartcc.org',
		pass: process.env.EMAIL_PASSWORD
	},
});

transport.use('compile', neh({
	viewPath: __dirname+"/email",
	viewEngine: {
		extName: ".hbs",
		layoutsDir: __dirname+"/email",
		partialsDir: __dirname+"/email",
		defaultLayout: "main"
	},
	extName: ".hbs"
}));

export default transport;



// organizational email list
// atm@zauartcc.org
// datm@zauartcc.org
// ta@zauartcc.org
// ec@zauartcc.org
// webmaster@zauartcc.org //maybe do wm@zauartcc.org
// fe@zauartcc.org
// management@zauartcc.org