import { type CanActivate, type ExecutionContext } from '@nestjs/common';
import { UserProfilesService } from './user-profiles.service.js';
export declare class EnsureActiveUserGuard implements CanActivate {
    private readonly userProfiles;
    constructor(userProfiles: UserProfilesService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
