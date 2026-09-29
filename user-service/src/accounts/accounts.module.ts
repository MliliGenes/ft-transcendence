import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { AccountImagesController } from './account-images.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AccountsController, AccountImagesController],
  providers: [AccountsService],
})
export class AccountsModule {}
