import express from 'express';
import Redis from 'ioredis';
import User from '../models/User.js';
import Pireps from '../models/Pireps.js';
import config from '../config/zab.js'

const router = express.Router();

router.post('/checktoken', async (req, res) => {
	const idsToken = req.body.token;
	try {
		if(!idsToken) {
			throw {
				code: 400,
				message: "No IDS token specified"
			};
		} else {
			const user = await User.findOne({idsToken: idsToken}).select('-email -idsToken').lean();
			if(!user) {
				throw {
					code: 403,
					message: "Invalid IDS token"
				};
			} else {
				res.stdRes.data = user;
			}
		}
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}
	
	return res.json(res.stdRes);
});

router.get('/aircraft', async (req, res) => {
	const pilots = await req.app.redis.get('pilots') || '';
	return res.json(pilots.split('|'));
});

router.get('/aircraft/feed', (req, res) => {
	const sub = new Redis(process.env.REDIS_URI);

	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	});

	sub.subscribe('PILOT:UPDATE', 'PILOT:DELETE');
	sub.on('message', async (channel, message) => {
		if(channel === "PILOT:UPDATE") {
			let data = await req.app.redis.hgetall(`PILOT:${message}`);
			data.type = 'update';
			res.write(`data: ${JSON.stringify(data)}\n\n`);
		}
		if(channel === "PILOT:DELETE") {
			res.write(`data: ${JSON.stringify({
				type: 'delete',
				callsign: message
			})}\n\n`);
		}
	});

	res.on('close', () => {
		sub.disconnect();
	});
});

router.get('/aircraft/:callsign', async (req, res) => {
	let data = await req.app.redis.hgetall(`PILOT:${req.params.callsign}`);
	return res.json(data);
});

router.get('/atis', (req, res) => {

	const sub = new Redis(process.env.REDIS_URI);

	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	});

	sub.subscribe('ATIS:UPDATE', 'ATIS:DELETE');
	sub.on('message', async (channel, message) => {
		if(channel === "ATIS:UPDATE") {
			let data = await req.app.redis.hgetall(`ATIS:${message}`);
			data.type = 'update';
			res.write(`data: ${JSON.stringify(data)}\n\n`);
		}
		if(channel === "ATIS:DELETE") {
			res.write(`data: ${JSON.stringify({
				type: 'delete',
				station: message
			})}\n\n`);
		}
	});

	res.on('close', () => {
		// sub.unsubscribe('ATIS:UPDATE', 'ATIS:DELETE');
		sub.disconnect();
	});
});

const acceptableAirports = config.airports;

router.post('/vatis', async (req, res) => {
  const { Facility, Preset, AtisLetter, AirportConditions, Notams, Timestamp, Version } = req.body;

  // check that all required fields are present
  if (!Facility || !Preset || !AtisLetter || !AirportConditions) {
    return res.status(400).send({ error: 'Missing required fields' });
  }

  // check that Facility is in the list of acceptable airports
  if (!acceptableAirports.includes(Facility)) {
    return res.status(400).send({ error: `Invalid airport: ${Facility}` });
  }

  let redisAtis = await req.app.redis.get('atis')
  redisAtis = (redisAtis && redisAtis.length) ? redisAtis.split('|') : [];
  redisAtis.push(Facility);
  req.app.redis.set('atis', redisAtis.join('|'));
  req.app.redis.expire(`atis`, 65);

  req.app.redis.hmset(`ATIS:${Facility}`,
    'station', Facility,
    'letter', AtisLetter,
    'preset', Preset,
    'airport_conditions', AirportConditions,
    'notams', Notams,
    'timestamp', Timestamp,
    'version', Version
  );
  req.app.redis.expire(`atis`, 65)
  req.app.redis.publish('ATIS:UPDATE', Facility);

  return res.sendStatus(200);
});

router.get('/stations', async (req, res) => {
	const airports = await req.app.redis.get('airports');
	return res.json(airports.split('|'));
});

router.get('/stations/:station', async (req, res) => {
	const station = req.params.station;
	const metar = await req.app.redis.get(`METAR:${station.toUpperCase()}`);
	const atisInfo = await req.app.redis.hgetall(`ATIS:${station}`);
	return res.json({metar, dep: atisInfo.dep || null, arr: atisInfo.arr || null, letter: atisInfo.letter || null})
});

router.get('/neighbors', async (req, res) => {
	const neighbors = await req.app.redis.get('neighbors') || '';
	return res.json((neighbors.length) ? neighbors.split('|') : '');
});

router.get('/pireps', async({res}) => {
	const pirep = await Pireps.find().sort('-reportTime').lean();
	return res.json(pirep);
});

router.post('/pireps', async(req, res) => {
	if(req.body.ua === undefined || req.body.ov === undefined) {
		return res.status(500).send('Missing UA or OV');
	} else {
		await Pireps.create({
			reportTime: new Date().getTime(),
			location: req.body.ov,
			aircraft: req.body.tp,
			flightLevel: req.body.fl,
			skyCond: req.body.sk,
			turbulence: req.body.tb,
			icing: req.body.ic,
			vis: req.body.wx,
			temp: req.body.ta,
			wind: req.body.wv,
			urgent: req.body.ua === 'UUA' ? true : false,
			manual: true
		});
		return res.sendStatus(200);
	}
});

router.delete('/pireps/:id', async(req, res) => {
	Pireps.findByIdAndDelete(req.params.id).then(() => {
		return res.sendStatus(200);
	}).catch((err) => {
		console.log(err);
		return res.sendStatus(500);
	});
});

export default router;