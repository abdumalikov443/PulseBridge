import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { View } from '../../libs/dto/view/view';
import { ViewInput } from '../../libs/dto/view/view.input';
import { T } from '../../libs/types/common';
import { OrdinaryInquiry } from '../../libs/dto/common/common.input';
import { ViewGroup } from '../../libs/enums/view.enum';
import { lookupVisit } from '../../libs/config';

@Injectable()
export class ViewService {
    constructor(@InjectModel("View") private readonly viewModel: Model<View>) {}

    public async recordView(input: ViewInput): Promise<View | null> {
        const viewExist = await this.checkViewExistence(input);
        if (!viewExist) {
            console.log("-- New View Insert --");
            return await this.viewModel.create(input);
        } else return null;
        return null;
    }

    private async checkViewExistence(input: ViewInput): Promise<View> {
        const {memberId, viewRefId} = input;
        const search: T = {memberId: memberId, viewRefId: viewRefId};
        return await this.viewModel.findOne(search).exec() as unknown as View;
    }


    // from: collection of the visited targets ("doctors" | "clinics")
    public async getVisited(memberId: ObjectId, input: OrdinaryInquiry, viewGroup: ViewGroup, from: string): Promise<T> {
        const { page, limit } = input;
        const match: T = { viewGroup: viewGroup, memberId: memberId };

        const data: T = await this.viewModel.aggregate([
            {$match: match},
            {$sort: { updatedAt: -1 }},
            {
                $lookup: {
                    from: from,
                    localField: "viewRefId",
                    foreignField: "_id",
                    as: "visitedTarget",
                },
            },
            { $unwind: "$visitedTarget" },
            {
                $facet: {
                    list: [
                        {$skip: (page-1)*limit},
                        {$limit: limit},
                        lookupVisit,
                        { $unwind: "$visitedTarget.memberData" },
                    ],
                    metaCounter: [{$count: "total"}],
                }
            }
        ])
        .exec();

        return { list: data[0].list.map((ele) => ele.visitedTarget), metaCounter: data[0].metaCounter };
    }
}
