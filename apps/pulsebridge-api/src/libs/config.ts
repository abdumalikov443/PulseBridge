import { ObjectId } from "bson";
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { T } from "./types/common";
import { pipeline } from "stream";


export const availableMemberSorts = ["createdAt", "updatedAt", "memberLikes", "memberViews"];
export const availableClinicSorts = ["createdAt", "updatedAt", "clinicLikes", "clinicViews", "clinicRank", "clinicDoctors", "clinicFollowers"];
export const availableDoctorSorts = ["createdAt", "updatedAt", "doctorLikes", "doctorViews", "doctorRank", "experience", "doctorFollowers"];
export const availableAppointmentSorts = ["createdAt", "updatedAt", "appointmentDate"];
export const availableArticleSorts = ['createdAt', 'updatedAt', 'articleLikes', 'articleViews'];
export const availableCommentSorts = ['createdAt', 'updatedAt'];
export const availableNoticeSorts = ['createdAt', 'updatedAt'];


// user text used inside $regex must be escaped (ReDoS / regex injection)
export const shapeIntoSearchRegex = (text: string) => {
	return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
};


/** TIMEZONE **/

// read at call time: .env is loaded after this file is imported
export const getAppTimezone = (): string => process.env.APP_TIMEZONE || 'Asia/Seoul';

// minutes the given timezone is ahead of UTC at the given instant
const getTimezoneOffsetMinutes = (timeZone: string, date: Date): number => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
	}).formatToParts(date);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	return (Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - date.getTime()) / 60000;
};

// "YYYY-MM-DD" + "HH:mm" wall-clock time in timeZone → real instant
export const zonedTimeToDate = (date: string, time: string, timeZone: string): Date => {
	const wallClockAsUtc = new Date(`${date}T${time}:00Z`);
	return new Date(wallClockAsUtc.getTime() - getTimezoneOffsetMinutes(timeZone, wallClockAsUtc) * 60000);
};


/** IMAGE CONFIGURATION **/
export const validMimeTypes = ['image/png', 'image/jpg', 'image/jpeg'];
export const availableUploadTargets = ['member', 'clinic', 'article'];
export const getSerialForImage = (filename: string) => {
	const ext = path.parse(filename).ext;
	return uuidv4() + ext;
};

export const shapeIntoMongoObjectId = (target: any) => {
    return typeof target === "string" ? new ObjectId(target) : target;
};


export const lookupAuthMemberLiked = (memerId: T, targetRefId: string = "$_id") => {
	return {
		$lookup: {
			from: "likes",
			let: {
				localLikeRefId: targetRefId,
				localMemberId: memerId,
				localMyFavorite: true
			},
			pipeline: [ 
				{
					$match: {
						$expr: { // likeRefId ni localLikeRefId ga teng holatini izla,  $$ => local variableni ishlatish uchun
							$and: [{$eq: ["$likeRefId", "$$localLikeRefId"]}, {$eq: ["$memberId", "$$localMemberId"]}]
						},
					},
				},
				{
					$project: {
						_id: 0, // id ni olib bermaslik uchun 0 qildik
						memberId: 1,
						likeRefId: 1,
						myFavorite: "$$localMyFavorite",
					},
				},
			],
			as: "meLiked",
		},
	};
};


export const lookupMember = {
	$lookup: {
		from: 'members',
		localField: 'memberId',
		foreignField: '_id',
		as: 'memberData'
	},
};

// does the viewer (followerId) follow the doctor / clinic with this id
export const lookupAuthMemberFollowed = (followerId: T, followRefId: string = "$_id") => {
	return {
		$lookup: {
			from: "follows",
			let: {
				localFollowerId: followerId,
				localFollowRefId: followRefId,
				localMyFollowing: true
			},
			pipeline: [
				{
					$match: {
						$expr: {
							$and: [{$eq: ["$followerId", "$$localFollowerId"]}, {$eq: ["$followRefId", "$$localFollowRefId"]}]
						},
					},
				},
				{
					$project: {
						_id: 0,
						followerId: 1,
						followRefId: 1,
						myFollowing: "$$localMyFollowing",
					},
				},
			],
			as: "meFollowed",
		},
	};
};

// followed doctor (with its member) / clinic; only one of them matches a follow
export const lookupFollowedDoctor = {
	$lookup: {
		from: 'doctors',
		localField: 'followRefId',
		foreignField: '_id',
		as: 'doctorData',
		pipeline: [lookupMember, { $unwind: '$memberData' }],
	},
};

export const lookupFollowedClinic = {
	$lookup: {
		from: 'clinics',
		localField: 'followRefId',
		foreignField: '_id',
		as: 'clinicData',
	},
};

export const lookupFollowerData = {
	$lookup: {
		from: 'members',
		localField: 'followerId',
		foreignField: '_id',
		as: 'followerData'
	},
};


export const lookupClinic = {
	$lookup: {
		from: 'clinics',
		localField: 'clinicId',
		foreignField: '_id',
		as: 'clinicData'
	},
};

// doctor with its member profile (name, image)
export const lookupDoctor = {
	$lookup: {
		from: 'doctors',
		localField: 'doctorId',
		foreignField: '_id',
		as: 'doctorData',
		pipeline: [lookupMember, { $unwind: '$memberData' }],
	},
};

export const lookupFavorite = {
	$lookup: {
		from: 'members',
		localField: 'favoriteTarget.memberId',
		foreignField: '_id',
		as: 'favoriteTarget.memberData'
	},
};


export const lookupVisit = {
	$lookup: {
		from: 'members',
		localField: 'visitedTarget.memberId',
		foreignField: '_id',
		as: 'visitedTarget.memberData'
	},
};