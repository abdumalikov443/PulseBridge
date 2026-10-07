import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Message } from 'apps/pulsebridge-api/src/libs/enums/common.enum';

// AuthGuard for REST routes (AuthGuard works only with GraphQL)
@Injectable()
export class HttpAuthGuard implements CanActivate {
	constructor(private authService: AuthService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (context.getType() !== 'http') return false;
		const request = context.switchToHttp().getRequest();

		const bearerToken = request.headers.authorization;
		if (!bearerToken) throw new UnauthorizedException(Message.TOKEN_NOT_EXIST);

		let authMember;
		try {
			authMember = await this.authService.verifyToken(bearerToken.split(' ')[1]);
		} catch (err) {
			throw new UnauthorizedException(Message.NOT_AUTHENTICATED);
		}
		if (!authMember) throw new UnauthorizedException(Message.NOT_AUTHENTICATED);

		// same place as the GraphQL guards, so @AuthMember() works here too
		request.body = request.body ?? {};
		request.body.authMember = authMember;
		return true;
	}
}
