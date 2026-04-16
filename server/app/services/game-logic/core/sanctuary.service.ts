import { SANCTUARY_CONSTANTS } from '@app/constants/game-logic.constants';
import { SanctuaryValidation, SanctuaryUseResult, CombatEffectParams } from '@app/interfaces/sanctuary.interface';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS } from '@common/direction';
import { TileItem, SanctuaryMode } from '@common/enums';
import { Player } from '@common/player';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame } from './active-game.interface';

@Injectable()
export class SanctuaryService {
    useSanctuary(game: ActiveGame, socketId: string, position: Vec2, mode: SanctuaryMode): SanctuaryUseResult | null {
        const validated = this.validateSanctuaryUse(game, socketId, position);
        if (!validated) return null;

        const { player, topLeft, sanctuaryType } = validated;
        const cooldownKey = `${topLeft.x},${topLeft.y}`;
        const ap = game.actionPoints.get(socketId) ?? 0;

        let healAmount = 0;
        let combatBonusApplied = false;

        if (sanctuaryType === TileItem.HealingSanctuary) {
            healAmount = this.applyHealingEffect(player, mode);
        } else {
            combatBonusApplied = this.applyCombatEffect({ game, socketId, player, mode });
        }

        game.actionPoints.set(socketId, ap - 1);
        game.sanctuaryCooldowns.set(cooldownKey, SANCTUARY_CONSTANTS.cooldownTurns);

        return {
            success: true,
            sanctuaryType,
            mode,
            healAmount,
            combatBonusApplied,
            playerNewLife: player.character.life,
            playerName: player.character.name,
            inactiveSanctuaries: this.computeInactiveSanctuaries(game),
        };
    }

    decrementSanctuaryCooldowns(game: ActiveGame, endedSocketId: string): string[] {
        for (const [key, turns] of game.sanctuaryCooldowns) {
            const newTurns = turns - 1;
            if (newTurns <= 0) {
                game.sanctuaryCooldowns.delete(key);
            } else {
                game.sanctuaryCooldowns.set(key, newTurns);
            }
        }
        return this.expireCombatBonus(game, endedSocketId);
    }

    computeInactiveSanctuaries(game: ActiveGame): Vec2[] {
        return Array.from(game.sanctuaryCooldowns.keys()).map((key) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
    }

    private validateSanctuaryUse(game: ActiveGame, socketId: string, position: Vec2): SanctuaryValidation | null {
        const ap = game.actionPoints.get(socketId) ?? 0;
        if (ap <= 0) return null;

        const tile = game.lobby.game.grid[position.y]?.[position.x];
        if (!tile) return null;

        const rawType = tile.item as TileItem;
        const isSanctuary = rawType === TileItem.HealingSanctuary || rawType === TileItem.CombatSanctuary;
        if (!isSanctuary) return null;
        const sanctuaryType = rawType as TileItem.HealingSanctuary | TileItem.CombatSanctuary;

        const topLeft = this.findSanctuaryTopLeft(game, position, sanctuaryType);
        if (game.sanctuaryCooldowns.has(`${topLeft.x},${topLeft.y}`)) return null;

        if (!this.isPlayerAdjacentToSanctuary(game, socketId, topLeft)) return null;

        const player = game.lobby.players.find((p) => p.socketId === socketId);
        if (!player) return null;

        return { player, topLeft, sanctuaryType };
    }

    private isPlayerAdjacentToSanctuary(game: ActiveGame, socketId: string, topLeft: Vec2): boolean {
        const playerPos = game.playerPositions.get(socketId);
        if (!playerPos) return false;

        const allFourCells: Vec2[] = [
            topLeft,
            { x: topLeft.x + 1, y: topLeft.y },
            { x: topLeft.x, y: topLeft.y + 1 },
            { x: topLeft.x + 1, y: topLeft.y + 1 },
        ];
        return allFourCells.some((cell) =>
            Object.values(DIRECTION_OFFSETS).some(
                (offset) => playerPos.x + offset.x === cell.x && playerPos.y + offset.y === cell.y,
            ),
        );
    }

    private applyHealingEffect(player: Player, mode: SanctuaryMode): number {
        let amount = SANCTUARY_CONSTANTS.healAmount;
        if (mode === SanctuaryMode.DoubleOrNothing) {
            amount = Math.random() < SANCTUARY_CONSTANTS.doubleOrNothingChance ? SANCTUARY_CONSTANTS.healAmount * 2 : 0;
        }
        const maxLife = player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
        player.character.life = Math.min(player.character.life + amount, maxLife);
        return amount;
    }

    private applyCombatEffect(params: CombatEffectParams): boolean {
        const { game, socketId, player, mode } = params;
        if (game.playerCombatBonuses.has(socketId)) return false;

        const apply = mode !== SanctuaryMode.DoubleOrNothing || Math.random() < SANCTUARY_CONSTANTS.doubleOrNothingChance;
        if (!apply) return false;

        const amount = mode === SanctuaryMode.DoubleOrNothing ? SANCTUARY_CONSTANTS.combatBonus * 2 : SANCTUARY_CONSTANTS.combatBonus;

        player.character.attack += amount;
        player.character.defense += amount;
        game.playerCombatBonuses.set(socketId, { turns: SANCTUARY_CONSTANTS.cooldownTurns, amount });
        return true;
    }

    private expireCombatBonus(game: ActiveGame, socketId: string): string[] {
        const bonusInfo = game.playerCombatBonuses.get(socketId);
        if (bonusInfo === undefined) return [];

        const newTurns = bonusInfo.turns - 1;
        if (newTurns > 0) {
            bonusInfo.turns = newTurns;
            return [];
        }

        const player = game.lobby.players.find((p) => p.socketId === socketId);
        if (player) {
            player.character.attack -= bonusInfo.amount;
            player.character.defense -= bonusInfo.amount;
        }
        game.playerCombatBonuses.delete(socketId);
        return [socketId];
    }

    private findSanctuaryTopLeft(game: ActiveGame, position: Vec2, item: TileItem): Vec2 {
        let { x, y } = position;
        const grid = game.lobby.game.grid;
        while (grid[y - 1]?.[x]?.item === item) y--;
        while (grid[y]?.[x - 1]?.item === item) x--;
        return { x, y };
    }
}
