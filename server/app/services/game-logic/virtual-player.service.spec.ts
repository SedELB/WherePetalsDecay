import { Test, TestingModule } from '@nestjs/testing';
import { VirtualPlayerService } from './virtual-player.service';

describe('VirtualPlayerService', () => {
  let service: VirtualPlayerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VirtualPlayerService],
    }).compile();

    service = module.get<VirtualPlayerService>(VirtualPlayerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
