import express from 'express';
import getUser from '../middleware/getUser.js';
import auth from '../middleware/auth.js';
import microAuth from '../middleware/microAuth.js';
import axios from 'axios';
import zab from '../config/zab.js';
const router = express.Router();

import ControllerHours from '../models/ControllerHours.js';
import Feedback from '../models/Feedback.js';
import TrainingRequest from '../models/TrainingRequest.js';
import TrainingSession from '../models/TrainingSession.js';
import User from '../models/User.js';
import { DateTime as L } from 'luxon'

const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ratings = ["Unknown", "OBS", "S1", "S2", "S3", "C1", "C2", "C3", "I1", "I2", "I3", "SUP", "ADM"];

router.get('/admin', getUser, auth(['atm', 'datm', 'ta', 'fe', 'ec', 'wm']), async (req, res) => {
	try {
		const d = new Date();
		const thisMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
		const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 1))
		const totalTime = await ControllerHours.aggregate([
			{$match: {timeStart: {$gt: thisMonth, $lt: nextMonth}}},
			{$project: {length: {$subtract: ['$timeEnd', '$timeStart']}}},
			{$group: {_id: null, total: {$sum: '$length'}}}
		])

		const sessionCount = await ControllerHours.aggregate([
			{$match: {timeStart: {$gt: thisMonth, $lt: nextMonth}}},
			{$group: {_id: null, total: {$sum: 1}}}
		])

		const feedback = await Feedback.aggregate([
			{$match: {approved: true}},
			{$project: { month: {$month: "$createdAt"}, year: {$year: "$createdAt"}}},
			{$group:
					{
						_id: {
							month: "$month",
							year: "$year"
						},
						total: { $sum: 1 },
						month: { $first: "$month" },
						year: { $first: "$year" },
					}
			},
			{$sort: {year: -1, month: -1}},
			{$limit: 12}
		]);

		const hours = await ControllerHours.aggregate([
			{
				$project: {
					length: {
						$subtract: ['$timeEnd', '$timeStart']
					},
					month: {
						$month: "$timeStart"
					},
					year: {
						$year: "$timeStart"
					}
				}
			},
			{
				$group: {
					_id: {
						month: "$month",
						year: "$year"
					},
					total: {$sum: '$length'},
					month: { $first: "$month" },
					year: { $first: "$year" },
				}
			},
			{$sort: {year: -1, month: -1}},
			{$limit: 12}
		]);

		for(const item of feedback) {
			item.month = months[item.month]
		}
		for(const item of hours) {
			item.month = months[item.month]
			item.total = Math.round(item.total/1000)
		}

		const homeCount = await User.countDocuments({member: true, vis: false});
		const visitorCount = await User.countDocuments({member: true, vis: true});
		const ratingCounts = await User.aggregate([
			{$match: {member: true}},
			{$group: {_id: "$rating", count: {$sum: 1}}},
			{$sort: {_id: -1}}
		])

		for(const item of ratingCounts) {
			item.rating = ratings[item._id];
		}

		res.stdRes.data.totalTime = Math.round(totalTime[0].total/1000);
		res.stdRes.data.totalSessions = Math.round(sessionCount[0].total);
		res.stdRes.data.feedback = feedback.reverse();
		res.stdRes.data.hours = hours.reverse();
		res.stdRes.data.counts = {
			home: homeCount,
			vis: visitorCount,
			byRating: ratingCounts.reverse()
		}
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
})

router.get('/ins', getUser, auth(['atm', 'datm', 'ta', 'ins', 'mtr', 'ia']), async (req, res) => {
	try {
		let lastTraining = await TrainingSession.aggregate([
			{$group: {
					_id: "$studentCid",
					studentCid: {$first: "$studentCid"},
					lastSession: {$last: "$endTime"},
					milestoneCode: {$first: "$milestoneCode"}
				}},
			{$sort: {lastSession: 1}}
		]);

		let lastRequest = await TrainingRequest.aggregate([
			{$group: {
					_id: "$studentCid",
					studentCid: {$first: "$studentCid"},
					lastRequest: {$last: "$endTime"},
					milestoneCode: {$first: "$milestoneCode"}
				}},
			{$sort: {lastSession: 1}}
		]);

		await TrainingSession.populate(lastTraining, {path: 'student'})
		await TrainingSession.populate(lastTraining, {path: 'milestone'})
		await TrainingRequest.populate(lastRequest, {path: 'milestone'})
		const allHomeControllers = await User.find({member:true, rating: {$lt: 12}}).select('-email -idsToken -discordInfo');
        const allCids = allHomeControllers.map(c => c.cid);
		lastTraining = lastTraining.filter(train => (train.student?.rating < 12 && train.student?.member && !train.student?.vis));
		const cidsWithTraining = lastTraining.map(train => train.studentCid);
		const cidsWithoutTraining = allCids.filter(cid => !cidsWithTraining.includes(cid))

		const controllersWithoutTraining = allHomeControllers.filter((c) => cidsWithoutTraining.includes(c.cid)).filter(c => !c.certCodes.includes('zau'));
		lastRequest = lastRequest.reduce((acc, cur) => {
			acc[cur.studentCid] = cur
			return acc;
		}, {})

		res.stdRes.data = {
			lastTraining,
			lastRequest,
			controllersWithoutTraining
		}
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
})

router.get('/activity', getUser, auth(['atm', 'datm', 'ta', 'wm']), async (req, res) => {
	try {
		const today = L.utc();
		const chkDate = today.minus({days: 31});
		const users = await User.find({member: true}).select('fname lname cid rating oi vis createdAt roleCodes certCodes joinDate').populate('certifications').lean({virtuals: true});
		const activityReduced = {};
		const trainingReduced = {};

		(await ControllerHours.aggregate([
			{$match: {timeStart: {$gt: chkDate}}},
			{$project: {
					length: {$subtract: ['$timeEnd', '$timeStart']},
					cid: 1
				}},
			{$group: {
					_id: "$cid",
					total: {$sum: "$length"}
				}}
		])).forEach(i => activityReduced[i._id] = i.total);
		(await TrainingRequest.aggregate([
			{$match: {startTime: {$gt: chkDate}}},
			{$group: {
					_id: "$studentCid",
					total: {$sum: 1}
				}}
		])).forEach(i => trainingReduced[i._id] = i.total);
		const userData = {};
		for(let user of users) {
			let fiftyTime = await req.app.redis.get(`FIFTY:${user.cid}`);
			if(!fiftyTime) {
				fiftyTime = await getFiftyData(user.cid);
				req.app.redis.set(`FIFTY:${user.cid}`, fiftyTime)
				req.app.redis.expire(`FIFTY:${user.cid}`, 86400)
			}

			const totalTime = Math.round(activityReduced[user.cid] / 1000) || 0;
			const totalRequests = trainingReduced[user.cid] || 0;

			userData[user.cid] = {
				...user,
				totalTime,
				totalRequests,
				fiftyTime: Math.round(fiftyTime),
				tooLow: totalTime < 3600 && (user.createdAt) < chkDate,
				protected: user.isStaff || [1202744].includes(user.cid)
			}
		}
		res.stdRes.data = Object.values(userData);
	}
	catch(e) {
		//req.app.Sentry.captureException(e);
        console.log(e);
		res.stdRes.ret_det = e;

	}

	return res.json(res.stdRes);
})

router.post('/fifty/:cid', microAuth, async (req, res) => {
	try {
		const { redis } = req.app;
		const { cid } = req.params;
		const fiftyData = await getFiftyData(cid);
		redis.set(`FIFTY:${cid}`, fiftyData)
		redis.expire(`FIFTY:${cid}`, 86400)
	}
	catch(e) {
		req.app.Sentry.captureException(e);
		res.stdRes.ret_det = e;
	}

	return res.json(res.stdRes);
})

const getFiftyData = async cid => {
	const today = L.utc();
	const chkDate = today.minus({days: 60});

	const {data: fiftyData} = await axios.get(`https://api.vatsim.net/api/ratings/${cid}/atcsessions/?start=${chkDate.toISODate()}&group_by_callsign`);

	let total = 0;

	for(const session of fiftyData.results) {
		const callsignParts = session.callsign.split('_');

		if(!zab.atcPos.includes(callsignParts[0])) {
			total += session.total_minutes_on_callsign;
		}
	}

	return total;
}

export default router;