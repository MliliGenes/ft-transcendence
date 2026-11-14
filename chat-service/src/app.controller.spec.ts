import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns the service status message', () => {
      expect(appController.getHello()).toEqual({
        message:
          'AM I THE BEST CAUSE I AM SAAD OR AM I SAD CAUSE I AM THE BEST?',
      });
    });
  });
});
