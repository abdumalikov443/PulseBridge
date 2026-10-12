// Top ranked doctors / clinics: like×2 + follower×3 + comment×1 + view×0.1, kept as an Int (×10)
// $add expressions for update pipelines, used by the API (on every stats change) and the batch (nightly check)

const rankExpr = (likes: string, followers: string, comments: string, views: string) => ({
	$add: [
		{ $multiply: [{ $ifNull: [`$${likes}`, 0] }, 20] },
		{ $multiply: [{ $ifNull: [`$${followers}`, 0] }, 30] },
		{ $multiply: [{ $ifNull: [`$${comments}`, 0] }, 10] },
		{ $ifNull: [`$${views}`, 0] },
	],
});

export const DOCTOR_RANK_KEYS = ['doctorLikes', 'doctorFollowers', 'doctorComments', 'doctorViews'];
export const CLINIC_RANK_KEYS = ['clinicLikes', 'clinicFollowers', 'clinicComments', 'clinicViews'];

export const doctorRankExpr = rankExpr('doctorLikes', 'doctorFollowers', 'doctorComments', 'doctorViews');
export const clinicRankExpr = rankExpr('clinicLikes', 'clinicFollowers', 'clinicComments', 'clinicViews');

// one atomic update: change the counter, then recalculate the rank from the new values
export const statsWithRankPipeline = (targetKey: string, modifier: number, rankKey: string, rankKeys: string[], expr: object) => {
	const pipeline: object[] = [{ $set: { [targetKey]: { $add: [{ $ifNull: [`$${targetKey}`, 0] }, modifier] } } }];
	if (rankKeys.includes(targetKey)) pipeline.push({ $set: { [rankKey]: expr } });
	return pipeline;
};
