import { createParamDecorator, SetMetadata, } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const CurrentUser = createParamDecorator((_data, ctx) => {
    const type = ctx.getType();
    if (type === 'ws')
        return ctx.switchToWs().getClient().data.user;
    return ctx.switchToHttp().getRequest().user;
});
//# sourceMappingURL=decorators.js.map