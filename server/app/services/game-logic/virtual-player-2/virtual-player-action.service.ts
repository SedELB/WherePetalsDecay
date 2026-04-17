import { Inject, Injectable } from '@nestjs/common';
import { VirtualPlayerCombatService } from './virtual-player-combat.service';
import { VirtualPlayerSanctuaryService } from './virtual-player-sanctuary.service';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';

@Injectable()
export class VirtualPlayerActionService {
    @Inject() readonly combat: VirtualPlayerCombatService;
    @Inject() readonly sanctuary: VirtualPlayerSanctuaryService;
    @Inject() readonly pathfinding: VirtualPlayerPathfindingService;
}
