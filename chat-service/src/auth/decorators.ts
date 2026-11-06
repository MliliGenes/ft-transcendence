import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export interface AccessTokenPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  iat: number;
  exp: number;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const type = ctx.getType();
    if (type === 'ws') return ctx.switchToWs().getClient().data.user;
    return ctx.switchToHttp().getRequest().user;
  },
);
