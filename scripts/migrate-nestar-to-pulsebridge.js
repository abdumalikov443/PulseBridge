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
 *   properties     collection dropped
 *
 * DOCTOR members get no `doctors` record: a clinic owner must add them to a clinic.
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
