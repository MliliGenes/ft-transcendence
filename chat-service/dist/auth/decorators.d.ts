export interface AccessTokenPayload {
    sub: string;
    iss: string;
    aud: string | string[];
    iat: number;
    exp: number;
}
export declare const IS_PUBLIC_KEY = "isPublic";
export declare const Public: () => import("@nestjs/common").CustomDecorator<string>;
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
