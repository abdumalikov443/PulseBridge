/**
 * One-time data migration: Nestar (real estate) -> PulseBridge (healthcare).
 *
 *   node scripts/migrate-nestar-to-pulsebridge.js            dry run on MONGO_DEV (prints counts only)
 *   node scripts/migrate-nestar-to-pulsebridge.js --apply    apply on MONGO_DEV
 *   add --prod to use MONGO_PROD
 *
 * Take a backup (mongodump) before --apply. The property data is deleted permanently.
 *
 * What it does:
 *   members        USER -> PATIENT, AGENT -> DOCTOR; drop memberProperties, memberAuthType, memberWarnings, memberBlocks
 *   boardArticles  renamed to articles; drop articleCategory
 *   likes/views/comments/notifications  delete PROPERTY and MEMBER groups (notifications: only PROPERTY)
 *   clinics        clinicType = PRIVATE where missing (clinics created before the field existed)
 *   doctors        old doctorStatus: PENDING -> clinicJoinRequests, REJECTED -> no clinic, field removed;
 *                  DOCTOR members without a profile get one (GENERAL, 0 years, no clinic)
 *   clinics        clinicDoctors counted where missing; CLINIC members without a clinic are only listed
 *   clinics        working hours 09:00-18:00 where missing
 *   follows        member->member follows become DOCTOR/CLINIC profile follows (others deleted),
 *                  old followingId index dropped, follower counters recalculated
 *   comments       ACTIVE comments of deleted articles -> DELETE; doctor/clinic/article comment counters recalculated
 *   properties     collection dropped
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const URI = process.argv.includes('--prod') ? process.env.MONGO_PROD : process.env.MONGO_DEV;
const OLD_GROUPS = ['PROPERTY', 'MEMBER'];

async function hasCollection(db, name) {
	return (await db.listCollections({ name }).toArray()).length > 0;
}

async function step(title, count, apply, always = false) {
	console.log(`${APPLY ? 'APPLY' : 'DRY  '} ${title}: ${count}`);
	if (APPLY && (count > 0 || always)) await apply();
}

async function main() {
	if (!URI) throw new Error('Mongo URI is not set in .env');
	await mongoose.connect(URI);
	const db = mongoose.connection.db;
	console.log(`Database: ${db.databaseName} (${APPLY ? 'APPLY' : 'dry run'})`);

	const members = db.collection('members');
	for (const [from, to] of [['USER', 'PATIENT'], ['AGENT', 'DOCTOR']]) {
		await step(`members ${from} -> ${to}`, await members.countDocuments({ memberType: from }), () =>
			members.updateMany({ memberType: from }, { $set: { memberType: to } }),
		);
	}
	const oldMemberFields = { memberProperties: '', memberAuthType: '', memberWarnings: '', memberBlocks: '' };
	const withOldFields = { $or: Object.keys(oldMemberFields).map((key) => ({ [key]: { $exists: true } })) };
	await step('members old fields removed', await members.countDocuments(withOldFields), () =>
		members.updateMany(withOldFields, { $unset: oldMemberFields }),
	);

	if (await hasCollection(db, 'boardArticles')) {
		if (await hasCollection(db, 'articles')) throw new Error('Both boardArticles and articles exist, merge them manually');
		await step('boardArticles renamed to articles', await db.collection('boardArticles').countDocuments(), () =>
			db.collection('boardArticles').rename('articles'),
		);
	}
	// in a dry run the rename has not happened yet
	const articles = db.collection((await hasCollection(db, 'articles')) ? 'articles' : 'boardArticles');
	await step('articles articleCategory removed', await articles.countDocuments({ articleCategory: { $exists: true } }), () =>
		articles.updateMany({ articleCategory: { $exists: true } }, { $unset: { articleCategory: '' } }),
	);

	for (const [name, field] of [['likes', 'likeGroup'], ['views', 'viewGroup'], ['comments', 'commentGroup']]) {
		const filter = { [field]: { $in: OLD_GROUPS } };
		await step(`${name} PROPERTY/MEMBER deleted`, await db.collection(name).countDocuments(filter), () =>
			db.collection(name).deleteMany(filter),
		);
	}

	const notifications = db.collection('notifications');
	await step('notifications PROPERTY deleted', await notifications.countDocuments({ notificationGroup: 'PROPERTY' }), () =>
		notifications.deleteMany({ notificationGroup: 'PROPERTY' }),
	);
	await step('notifications propertyId removed', await notifications.countDocuments({ propertyId: { $exists: true } }), () =>
		notifications.updateMany({ propertyId: { $exists: true } }, { $unset: { propertyId: '' } }),
	);

	// clinics created before clinicType existed
	const clinics = db.collection('clinics');
	await step('clinics without clinicType set to PRIVATE', await clinics.countDocuments({ clinicType: { $exists: false } }), () =>
		clinics.updateMany({ clinicType: { $exists: false } }, { $set: { clinicType: 'PRIVATE' } }),
	);

	// clinics created before working hours existed: default 09:00-18:00, no break, no days off
	await step('clinics without working hours set to 09:00-18:00', await clinics.countDocuments({ clinicOpenTime: { $exists: false } }), () =>
		clinics.updateMany(
			{ clinicOpenTime: { $exists: false } },
			{ $set: { clinicOpenTime: '09:00', clinicCloseTime: '18:00', clinicBreakStart: null, clinicBreakEnd: null, clinicOffDays: [] } },
		),
	);

	// previous design kept the join request in doctors.doctorStatus -> clinicId + clinicJoinRequests
	const doctors = db.collection('doctors');
	const requests = db.collection('clinicJoinRequests');
	const pendingDoctors = await doctors.find({ doctorStatus: 'PENDING' }).toArray();
	await step('PENDING doctors moved to clinicJoinRequests', pendingDoctors.length, async () => {
		const now = new Date();
		await requests.insertMany(pendingDoctors.map((d) => ({ doctorId: d._id, clinicId: d.clinicId, requestStatus: 'PENDING', createdAt: now, updatedAt: now })));
		await doctors.updateMany({ doctorStatus: 'PENDING' }, { $set: { clinicId: null } });
	});
	await step('REJECTED doctors detached from the clinic', await doctors.countDocuments({ doctorStatus: 'REJECTED' }), () =>
		doctors.updateMany({ doctorStatus: 'REJECTED' }, { $set: { clinicId: null } }),
	);
	await step('doctors doctorStatus field removed', await doctors.countDocuments({ doctorStatus: { $exists: true } }), () =>
		doctors.updateMany({ doctorStatus: { $exists: true } }, { $unset: { doctorStatus: '' } }),
	);

	// every DOCTOR member has a profile (signup creates it now); AGENT counts in a dry run
	const doctorMemberIds = (await doctors.find({}, { projection: { memberId: 1 } }).toArray()).map((d) => d.memberId);
	const noProfile = await members.find({ memberType: { $in: ['DOCTOR', 'AGENT'] }, _id: { $nin: doctorMemberIds } }, { projection: { _id: 1 } }).toArray();
	await step('DOCTOR members without profile: profile created (GENERAL, 0 years, no clinic)', noProfile.length, () => {
		const now = new Date();
		return doctors.insertMany(noProfile.map((m) => ({
			memberId: m._id, clinicId: null, specialty: 'GENERAL', experience: 0,
			doctorViews: 0, doctorLikes: 0, doctorComments: 0, doctorRank: 0, createdAt: now, updatedAt: now,
		})));
	});

	// CLINIC members without a clinic cannot be fixed automatically (name, address are unknown)
	const clinicOwnerIds = (await clinics.find({}, { projection: { memberId: 1 } }).toArray()).map((c) => c.memberId);
	const noClinic = await members.find({ memberType: 'CLINIC', _id: { $nin: clinicOwnerIds } }, { projection: { memberNick: 1 } }).toArray();
	if (noClinic.length) console.log(`WARN  CLINIC members without a clinic, delete them and sign up again: ${noClinic.map((m) => m.memberNick).join(', ')}`);

	const noCounter = await clinics.find({ clinicDoctors: { $exists: false } }, { projection: { _id: 1 } }).toArray();
	await step('clinics clinicDoctors counted', noCounter.length, () =>
		Promise.all(noCounter.map(async (c) =>
			clinics.updateOne({ _id: c._id }, { $set: { clinicDoctors: await doctors.countDocuments({ clinicId: c._id }) } }),
		)),
	);

	// follows: member -> member (followingId) becomes member -> DOCTOR / CLINIC profile (followGroup, followRefId)
	const follows = db.collection('follows');
	// drop the old unique index first: it treats a missing followingId as null, so converting
	// a follow of a member who already has a new-format follow would be a duplicate key
	const followIndexes = (await hasCollection(db, 'follows')) ? await follows.indexes() : [];
	const oldIndex = followIndexes.find((i) => i.key.followingId !== undefined);
	if (oldIndex) await step(`follows old index ${oldIndex.name} dropped`, 1, () => follows.dropIndex(oldIndex.name));
	const oldFollows = await follows.find({ followingId: { $exists: true } }).toArray();
	await step('old member follows moved to doctor/clinic profiles (others and duplicates deleted)', oldFollows.length, async () => {
		for (const f of oldFollows) {
			const doctor = await doctors.findOne({ memberId: f.followingId });
			const clinic = doctor ? null : await clinics.findOne({ memberId: f.followingId });
			const target = doctor ? { followGroup: 'DOCTOR', followRefId: doctor._id } : clinic ? { followGroup: 'CLINIC', followRefId: clinic._id } : null;
			// the member may already follow the same profile in the new format
			const duplicate = target && (await follows.findOne({ followerId: f.followerId, followRefId: target.followRefId }));
			if (target && !duplicate) await follows.updateOne({ _id: f._id }, { $set: target, $unset: { followingId: '' } });
			else await follows.deleteOne({ _id: f._id });
		}
	});
	await step('follow counters recalculated', await follows.countDocuments(), async () => {
		await doctors.updateMany({}, { $set: { doctorFollowers: 0 } });
		await clinics.updateMany({}, { $set: { clinicFollowers: 0 } });
		await members.updateMany({}, { $set: { memberFollowers: 0, memberFollowings: 0 } });
		for (const g of await follows.aggregate([{ $group: { _id: { group: '$followGroup', ref: '$followRefId' }, n: { $sum: 1 } } }]).toArray()) {
			const col = g._id.group === 'DOCTOR' ? doctors : clinics;
			await col.updateOne({ _id: g._id.ref }, { $set: { [g._id.group === 'DOCTOR' ? 'doctorFollowers' : 'clinicFollowers']: g.n } });
		}
		for (const g of await follows.aggregate([{ $group: { _id: '$followerId', n: { $sum: 1 } } }]).toArray()) {
			await members.updateOne({ _id: g._id }, { $set: { memberFollowings: g.n } });
		}
	}, true);

	// comments of deleted articles were left ACTIVE before the cascade existed
	const comments = db.collection('comments');
	const deletedArticleIds = (await articles.find({ articleStatus: 'DELETE' }, { projection: { _id: 1 } }).toArray()).map((a) => a._id);
	const orphanFilter = { commentGroup: 'ARTICLE', commentRefId: { $in: deletedArticleIds }, commentStatus: 'ACTIVE' };
	await step('ACTIVE comments of deleted articles set to DELETE', await comments.countDocuments(orphanFilter), () =>
		comments.updateMany(orphanFilter, { $set: { commentStatus: 'DELETE' } }),
	);
	// counters counted only ACTIVE comments once deletes/blocks started to decrement them
	await step('comment counters recalculated from ACTIVE comments', await comments.countDocuments(), async () => {
		await doctors.updateMany({}, { $set: { doctorComments: 0 } });
		await clinics.updateMany({}, { $set: { clinicComments: 0 } });
		await articles.updateMany({}, { $set: { articleComments: 0 } });
		const targets = { DOCTOR: [doctors, 'doctorComments'], CLINIC: [clinics, 'clinicComments'], ARTICLE: [articles, 'articleComments'] };
		for (const g of await comments.aggregate([{ $match: { commentStatus: 'ACTIVE' } }, { $group: { _id: { group: '$commentGroup', ref: '$commentRefId' }, n: { $sum: 1 } } }]).toArray()) {
			const target = targets[g._id.group];
			if (target) await target[0].updateOne({ _id: g._id.ref }, { $set: { [target[1]]: g.n } });
		}
	}, true);

	if (await hasCollection(db, 'properties')) {
		await step('properties collection dropped', await db.collection('properties').countDocuments(), () =>
			db.collection('properties').drop(), true,
		);
	}

	if (!APPLY) console.log('\nDry run only. Re-run with --apply after taking a backup.');
}

main()
	.catch((err) => {
		console.error('Migration failed:', err.message);
		process.exitCode = 1;
	})
	.finally(() => mongoose.disconnect());
