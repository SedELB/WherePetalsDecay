import { Injectable } from '@nestjs/common';
import { VirtualPlayerCombatService } from './virtual-player-combat.service';
import { VirtualPlayerSanctuaryService } from './virtual-player-sanctuary.service';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';

@Injectable()
export class VirtualPlayerActionService {
    constructor(
        readonly combat: VirtualPlayerCombatService,
        readonly sanctuary: VirtualPlayerSanctuaryService,
        readonly pathfinding: VirtualPlayerPathfindingService,
    ) {}
}
