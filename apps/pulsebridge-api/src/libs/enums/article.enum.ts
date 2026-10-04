import { registerEnumType } from '@nestjs/graphql';

export enum ArticleStatus {
	ACTIVE = 'ACTIVE',
	DELETE = 'DELETE',
}
registerEnumType(ArticleStatus, {
	name: 'ArticleStatus',
});
