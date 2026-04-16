import { TestBed } from '@angular/core/testing';
import { GameViewCombatService } from '@app/services/game-view/game-view-combat.service';
import { DiceType, PlayerType } from '@common/enums';
import { CombatEndedData } from '@common/interfaces/game-view';
import { Player } from '@common/player';

function createPlayer(socketId: string, name: string): Player {
    return {
        socketId,
        character: {
            name,
            avatar: 'avatar.png',
            life: 4,
            speed: 4,
            attack: 4,
            defense: 4,
            lifeBonus: false,
            attackDice: DiceType.D6,
            defenseDice: DiceType.D4,
        },
        winsCount: 0,
        isHost: false,
        hasAbandonned: false,
        playerType: PlayerType.Reel,
        hasFlag: false,
        combatCount: 0,
        lossCount: 0,
        totalHpLost: 0,
        totalHpDealt: 0,
        visitedTilesCount: 0,
    };
}

describe('GameViewCombatService', () => {
    let service: GameViewCombatService;
    let players: Player[];

    const baseCombatEndedData: CombatEndedData = {
        roomId: 'room-1',
        attackerSocketId: 'local-socket',
        defenderSocketId: 'enemy-socket',
        attackerKilled: false,
        defenderKilled: true,
        winnerId: 'local-socket',
        reason: 'death',
    };

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(GameViewCombatService);
        players = [createPlayer('local-socket', 'Alice'), createPlayer('enemy-socket', 'Bob')];
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should show "Vous" and proper grammar when local player wins', () => {
        service.handleCombatEnded(baseCombatEndedData, players, 'local-socket');

        expect(service.combatEndPopup()).toEqual({
            title: 'Fin du combat',
            message: 'Bob est mort. Vous gagnez le combat.',
        });
    });

    it('should show "Vous" when local player abandons', () => {
        const combatEnded: CombatEndedData = {
            ...baseCombatEndedData,
            winnerId: 'enemy-socket',
            attackerKilled: false,
            defenderKilled: false,
            reason: 'abandon',
        };

        service.handleCombatEnded(combatEnded, players, 'local-socket');

        expect(service.combatEndPopup()).toEqual({
            title: 'Fin du combat',
            message: 'Vous avez abandonné. Bob gagne le combat.',
        });
    });

    it('should not show popup for non-participant local id', () => {
        service.handleCombatEnded(baseCombatEndedData, players, 'other-socket');

        expect(service.combatEndPopup()).toBeNull();
    });
});
