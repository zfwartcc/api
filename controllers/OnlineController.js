import express from 'express';
const router = express.Router();
import PilotOnline from '../models/PilotOnline.js';
import AtcOnline from '../models/AtcOnline.js';
import ControllerHours from '../models/ControllerHours.js';
import AtcScheduled from '../models/AtcScheduled.js';

const airports = {
	ORD: 'O\'Hare', 
    MDW: 'Midway', 
    SBN: 'South Bend', 
    MKE: 'Milwaukee', 
    GRR: 'Grand Rapids',
	AZO: 'Kalamazoo',
	BTL: 'Battle Creek',
	EKM: 'Elkhart',
	ENW: 'Kenosha',
	RAC: 'Racine',
	PWK: 'Palwaukee',
	ARR: 'Aurora',
	DPA: 'Du Page',
	CID: 'Cedar Rapids',
	UGN: 'Waukegan',
	MSN: 'Madision',
	JVL: 'Janesville',
	GYY: 'Gary',
	MLI: 'Moline',
	OSH: 'Oshkosh',
	UES: 'Waukesha',
	VOK: 'Volk',
	MKG: 'Muskegan',
	ALO: 'Waterloo',
	DBQ: 'Dubuque',
	DEC: 'Decatur',
	FWA: 'Fort Wayne',
	GUS: 'Grissom',
	CMI: 'Champign',
	LAF: 'Lafayette',
	MWC: 'Timmerman',
	RFD: 'Rockford',
	CHI: 'Chicago',
};

const positions = {
	DEL: 'Delivery',
	GND: 'Ground',
	TWR: 'Tower',
	DEP: 'Departure',
	APP: 'Approach',
	CTR: 'Center'
};

router.get('/', async ({res}) => {
	try {
		const pilots = await PilotOnline.find().lean();
		const atc = await AtcOnline.find().lean({virtuals: true});

		res.stdRes.data = {
			pilots: pilots,
			atc: atc
		}
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
});

router.get('/top', async (req, res) => {
	try {
		const d = new Date();
		const thisMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
		const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 1))
		const sessions = await ControllerHours.find({timeStart: {$gt: thisMonth, $lt: nextMonth}, position: {$not: /.*_(I|M)_.*/}}).populate('user', 'fname lname cid');
		const controllerTimes = {};
		const positionTimes = {};
		for(const session of sessions) {
			const posSimple = session.position.replace(/_[A-Z0-9]{1,3}_/, '_');
			const len = Math.round((session.timeEnd.getTime() - session.timeStart.getTime()) / 1000);
			if(!controllerTimes[session.cid]) {
				controllerTimes[session.cid] = {
					name: session.user ? `${session.user.fname} ${session.user.lname}` : session.cid,
					cid: session.cid,
					len: 0
				};
			}
			if(!positionTimes[posSimple]) {
				const posParts = posSimple.split('_');
				positionTimes[posSimple] = {
					name: `${airports[posParts[0]] ? airports[posParts[0]] : 'Unknown'} ${positions[posParts[1]] ? positions[posParts[1]] : 'Unknown'}`,
					len: 0
				}
			}
			controllerTimes[session.cid].len += len;
			positionTimes[posSimple].len += len;
		}
		res.stdRes.data.controllers = Object.values(controllerTimes).sort((a, b) => b.len - a.len).slice(0,5);
		res.stdRes.data.positions = Object.values(positionTimes).sort((a, b) => b.len - a.len).slice(0,5);
	} catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
})

router.get('/scheduledpositions', async (req, res) => {
	console.log('API called: scheduledpositions');
	console.log('Request query:', req.query);
	const queryDate = req.query.date;
	const start = new Date(`${queryDate}T00:00:00.000Z`);
	const end = new Date(`${queryDate}T23:59:59.999Z`);
	const positions = await AtcScheduled.find({
	  day: { $gte: start, $lt: end },
	}).lean();
	res.send(positions);
  });
  

export default router;