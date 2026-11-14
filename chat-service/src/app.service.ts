import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      message: 'AM I THE BEST CAUSE I AM SAAD OR AM I SAD CAUSE I AM THE BEST?',
    };
  }
}
