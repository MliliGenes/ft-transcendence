import { Module } from '@nestjs/common';
import { PresenceAudienceService } from './presence-audience.service.js';
import { PresenceService } from './presence.service.js';

@Module({
  providers: [PresenceService, PresenceAudienceService],
  exports: [PresenceService, PresenceAudienceService],
})
export class PresenceModule {}
