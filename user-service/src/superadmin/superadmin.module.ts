import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SuperadminController } from './superadmin.controller.js';
import { SuperadminGuard } from './guards/superadmin.guard.js';
import { SuperadminService } from './superadmin.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SuperadminController],
  providers: [SuperadminGuard, SuperadminService],
})
export class SuperadminModule {}
