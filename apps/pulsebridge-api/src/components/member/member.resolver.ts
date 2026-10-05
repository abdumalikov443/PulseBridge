import { Query, Mutation, Resolver, Args } from '@nestjs/graphql';
import { MemberService } from './member.service';
import { LoginInput, MemberInput, MembersInquiry } from '../../libs/dto/member/member.input';
import { Member, Members } from '../../libs/dto/member/member';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { ObjectId } from 'mongoose';
import { MemberType } from '../../libs/enums/member.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberUpdate } from '../../libs/dto/member/member.update';
import { availableUploadTargets, getSerialForImage, shapeIntoMongoObjectId, validMimeTypes } from '../../libs/config';
import { WithoutGuard } from '../auth/guards/without.guard';
import { GraphQLUpload, FileUpload } from 'graphql-upload';
import { createWriteStream, mkdirSync } from 'fs';
import { Message } from '../../libs/enums/common.enum';

@Resolver()
export class MemberResolver {
    constructor(private readonly memberService: MemberService) { }

    @Mutation(() => Member)
    public async signup(@Args("input") input: MemberInput): Promise<Member> {
        console.log("Mutation: signup");
        return await this.memberService.signup(input);
    }

    @Mutation(() => Member)
    public async login(@Args("input") input: LoginInput): Promise<Member> {
        console.log("Mutation: login");
        return await this.memberService.login(input);
    }

    @UseGuards(AuthGuard)
    @Query(() => String)
    public async checkAuth(@AuthMember('memberNick') memberNick: string): Promise<string> {
        console.log("Mutation: checkAuth");
        console.log("memberNick => ", memberNick);
        return await `Hi ${memberNick}`;
    }

    @Roles(MemberType.PATIENT)
    @UseGuards(AuthGuard)
    @Query(() => String)
    public async checkAuthRoles(@AuthMember() authMember: Member): Promise<string> {
        console.log("Mutation: checkAuth");
        return await `Hi ${authMember.memberNick} you are ${authMember.memberType} (memberId: ${authMember._id})`;
    }
    
    @UseGuards(AuthGuard)
    @Mutation(() => Member)
    public async updateMember(
        @Args("input") input: MemberUpdate,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Member> {
        console.log("Mutation: updateMember"); //@ts-ignore
        delete input._id;
        // status is changed only by admin
        delete input.memberStatus;
        return await this.memberService.updateMember(memberId, input);
    }

    @UseGuards(WithoutGuard)
    @Query(() => Member)
    public async getMember(
        @Args('memberId') input: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Member> {
        console.log("Mutation: getMember");
        const targetId = shapeIntoMongoObjectId(input)
        return await this.memberService.getMember(memberId, targetId);
    }

    /** ADMIN **/

    @Roles(MemberType.ADMIN)
    @UseGuards(RolesGuard)
    @Query(() => Members)
    public async getAllMembersByAdmin(@Args('input') input: MembersInquiry): Promise<Members> {
        console.log("Query: getAllMembersByAdmin");
        return await this.memberService.getAllMembersByAdmin(input);
    }

    @Roles(MemberType.ADMIN)
    @UseGuards(RolesGuard)
    @Mutation(() => Member)
    public async updateMemberByAdmin(@Args('input') input: MemberUpdate): Promise<Member> {
        console.log("Mutation: updateMemberByAdmin");
        return await this.memberService.updateMemberByAdmin(input);
    }

    /** UPLOADER **/

    @UseGuards(AuthGuard)
    @Mutation((returns) => String)
    public async imageUploader(
        @Args({ name: 'file', type: () => GraphQLUpload })
    { createReadStream, filename, mimetype }: FileUpload,
    @Args('target') target: String,
    ): Promise<string> {
        console.log('Mutation: imageUploader');

        if (!filename) throw new Error(Message.UPLOAD_FAILED);
    this.checkUploadTarget(target);
    const validMime = validMimeTypes.includes(mimetype);
    if (!validMime) throw new Error(Message.PROVIDE_ALLOWED_FORMAT);

    const imageName = getSerialForImage(filename);
    const url = `uploads/${target}/${imageName}`;
    const stream = createReadStream();

    const result = await new Promise((resolve, reject) => {
        stream
            .pipe(createWriteStream(url))
            .on('finish', async () => resolve(true))
            .on('error', () => reject(false));
    });
    if (!result) throw new Error(Message.UPLOAD_FAILED);

    return url;
    }

    @UseGuards(AuthGuard)
    @Mutation((returns) => [String])
    public async imagesUploader(
        @Args('files', { type: () => [GraphQLUpload] })
    files: Promise<FileUpload>[],
    @Args('target') target: String,
    ): Promise<string[]> {
        console.log('Mutation: imagesUploader');
        this.checkUploadTarget(target);

        const uploadedImages = [];
        const promisedList = files.map(async (img: Promise<FileUpload>, index: number): Promise<Promise<void>> => {
            try {
                const { filename, mimetype, encoding, createReadStream } = await img;

                const validMime = validMimeTypes.includes(mimetype);
                if (!validMime) throw new Error(Message.PROVIDE_ALLOWED_FORMAT);

                const imageName = getSerialForImage(filename);
                const url = `uploads/${target}/${imageName}`;
                const stream = createReadStream();

                const result = await new Promise((resolve, reject) => {
                    stream
                        .pipe(createWriteStream(url))
                        .on('finish', () => resolve(true))
                        .on('error', () => reject(false));
                });
                if (!result) throw new Error(Message.UPLOAD_FAILED); //@ts-ignore

                uploadedImages[index] = url;
            }   catch (err) {
                    console.log('Error, file missing!');
            }
        });

        await Promise.all(promisedList);
        return uploadedImages;
    }

    // only known folders: blocks path traversal like "../../etc"
    private checkUploadTarget(target: String): void {
        if (!availableUploadTargets.includes(String(target))) throw new Error(Message.BAD_REQUEST);
        mkdirSync(`uploads/${target}`, { recursive: true });
    }
}
