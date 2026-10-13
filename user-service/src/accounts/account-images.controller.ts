import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import type { UserImageKind } from '../generated/prisma/client.js';

// Profile images are public; account changes remain in the guarded controller.
@Controller('accounts')
export class AccountImagesController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get(':id/avatar')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  getAvatar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.getImage(id, 'AVATAR');
  }

  @Get(':id/banner')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  getBanner(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.getImage(id, 'BANNER');
  }

  private async getImage(id: string, kind: UserImageKind) {
    const image = await this.accountsService.getImage(id, kind);
    return new StreamableFile(Buffer.from(image.data), {
      type: image.contentType,
      disposition: 'inline',
      length: image.data.byteLength,
    });
  }
}
