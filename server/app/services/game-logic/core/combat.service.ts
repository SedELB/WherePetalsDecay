import {
    CombatDeathResolution,
    CombatDiceStrategy,
    CombatParticipants,
    CombatStatsSnapshot,
    DiceRollMode,
    StatInput,
} from '@app/interfaces/combat.interface';
import { COMBAT_CONSTANTS } from '@app/constants/game-logic.constants';
import { Posture } from '@common/character';
import { BASE_STATS } from '@common/constants/character.constants';
import { DIRECTION_OFFSETS } from '@common/direction';
import { PostureType, TileTexture } from '@common/enums';
import { CombatResult } from '@common/interfaces/game-view';
import { Player } from '@common/player';
import { TILE_COSTS } from '@common/tile-costs';
import { Vec2 } from '@common/vec2';
import { Injectable } from '@nestjs/common';
import { ActiveGame, VICTORIES_TO_WIN } from './active-game.interface';


@Injectable()
export class CombatService {
    getAdjacentPlayers(game: ActiveGame, socketId: string): Player[] {
        const pos = game.playerPositions.get(socketId);
        if (!pos) return [];

        const adjacentPositions = Object.values(DIRECTION_OFFSETS).map((offset) => ({
            x: pos.x + offset.x,
            y: pos.y + offset.y,
        }));

        return game.lobby.players.filter((player) => {
            if (player.socketId === socketId || player.hasAbandonned) return false;
            const pPos = game.playerPositions.get(player.socketId);
            return pPos && adjacentPositions.some((adj) => adj.x === pPos.x && adj.y === pPos.y);
        });
    }

    initiateCombat(
        game: ActiveGame,
        attackerId: string,
        defenderId: string,
        consumeActionPoint = true,
        diceStrategy?: CombatDiceStrategy,
    ): CombatResult | null {
        if (!this.tryConsumeActionPoint(game, attackerId, consumeActionPoint)) return null;

        const participants = this.getCombatParticipants(game, attackerId, defenderId);
        if (!participants) return null;

        const statsSnapshot = this.computeCombatStats(game, participants, diceStrategy);
        this.applyCombatDamageAndTracking(participants, statsSnapshot);

        const deathResolution = this.resolveCombatDeaths(game, participants, attackerId, defenderId);

        return {
            attacker: {
                socketId: attackerId,
                attack: statsSnapshot.attackerAttack,
                defense: statsSnapshot.attackerDefense,
                damageDealt: statsSnapshot.damageToDefender,
                lifeBefore: statsSnapshot.attackerLifeBefore,
                lifeAfter: participants.attacker.character.life,
                killed: deathResolution.attackerKilled,
                oldPosition: participants.attackerOldPosition,
                newPosition: deathResolution.attackerNewPosition,
            },
            defender: {
                socketId: defenderId,
                attack: statsSnapshot.defenderAttack,
                defense: statsSnapshot.defenderDefense,
                damageDealt: statsSnapshot.damageToAttacker,
                lifeBefore: statsSnapshot.defenderLifeBefore,
                lifeAfter: participants.defender.character.life,
                killed: deathResolution.defenderKilled,
                oldPosition: participants.defenderOldPosition,
                newPosition: deathResolution.defenderNewPosition,
            },
            winnerId: deathResolution.winnerId,
            loserId: deathResolution.loserId,
        };
    }

    private tryConsumeActionPoint(game: ActiveGame, attackerId: string, consumeActionPoint: boolean): boolean {
        if (!consumeActionPoint) return true;

        const actionPoints = game.actionPoints.get(attackerId) ?? 0;
        if (actionPoints <= 0) return false;

        game.actionPoints.set(attackerId, actionPoints - 1);
        return true;
    }

    private getCombatParticipants(game: ActiveGame, attackerId: string, defenderId: string): CombatParticipants | null {
        const adjacentPlayers = this.getAdjacentPlayers(game, attackerId);
        if (!adjacentPlayers.some((player) => player.socketId === defenderId)) return null;

        const attacker = game.lobby.players.find((player) => player.socketId === attackerId);
        const defender = game.lobby.players.find((player) => player.socketId === defenderId);
        if (!attacker || !defender) return null;

        const attackerOldPosition = game.playerPositions.get(attackerId);
        const defenderOldPosition = game.playerPositions.get(defenderId);
        if (!attackerOldPosition || !defenderOldPosition) return null;

        return {
            attacker,
            defender,
            attackerOldPosition,
            defenderOldPosition,
        };
    }

    private computeCombatStats(
        game: ActiveGame,
        participants: CombatParticipants,
        diceStrategy?: CombatDiceStrategy,
    ): CombatStatsSnapshot {
        const attackerPenalty = this.getIcePenalty(game, participants.attacker.socketId);
        const defenderPenalty = this.getIcePenalty(game, participants.defender.socketId);

        participants.attacker.character.debuf = attackerPenalty;
        participants.defender.character.debuf = defenderPenalty;

        const attackerDiceMode = diceStrategy?.attacker ?? DiceRollMode.Random;
        const defenderDiceMode = diceStrategy?.defender ?? DiceRollMode.Random;

        const attackerAttack = this.buildStat({
            base: participants.attacker.character.attack,
            postureBonus: this.getPostureBonus(participants.attacker.character.bonusPosture, PostureType.Attack),
            diceBonus: this.rollDice(participants.attacker.character.attackDice, attackerDiceMode),
            penalty: attackerPenalty,
        });

        const attackerDefense = this.buildStat({
            base: participants.attacker.character.defense,
            postureBonus: this.getPostureBonus(participants.attacker.character.bonusPosture, PostureType.Defense),
            diceBonus: this.rollDice(participants.attacker.character.defenseDice, attackerDiceMode),
            penalty: attackerPenalty,
        });

        const defenderAttack = this.buildStat({
            base: participants.defender.character.attack,
            postureBonus: this.getPostureBonus(participants.defender.character.bonusPosture, PostureType.Attack),
            diceBonus: this.rollDice(participants.defender.character.attackDice, defenderDiceMode),
            penalty: defenderPenalty,
        });

        const defenderDefense = this.buildStat({
            base: participants.defender.character.defense,
            postureBonus: this.getPostureBonus(participants.defender.character.bonusPosture, PostureType.Defense),
            diceBonus: this.rollDice(participants.defender.character.defenseDice, defenderDiceMode),
            penalty: defenderPenalty,
        });

        const damageToAttacker = Math.max(defenderAttack.total - attackerDefense.total, 0);
        let damageToDefender = Math.max(attackerAttack.total - defenderDefense.total, 0);

        if (damageToDefender === 0 && damageToAttacker === 0) {
            damageToDefender = 1;
        }

        return {
            attackerAttack,
            attackerDefense,
            defenderAttack,
            defenderDefense,
            damageToDefender,
            damageToAttacker,
            attackerLifeBefore: participants.attacker.character.life,
            defenderLifeBefore: participants.defender.character.life,
        };
    }

    private applyCombatDamageAndTracking(participants: CombatParticipants, statsSnapshot: CombatStatsSnapshot): void {
        participants.attacker.character.life = Math.max(statsSnapshot.attackerLifeBefore - statsSnapshot.damageToAttacker, 0);
        participants.defender.character.life = Math.max(statsSnapshot.defenderLifeBefore - statsSnapshot.damageToDefender, 0);

        participants.attacker.combatCount++;
        participants.defender.combatCount++;

        participants.attacker.totalHpDealt += statsSnapshot.damageToDefender;
        participants.attacker.totalHpLost += statsSnapshot.damageToAttacker;
        participants.defender.totalHpDealt += statsSnapshot.damageToAttacker;
        participants.defender.totalHpLost += statsSnapshot.damageToDefender;
    }

    private resolveCombatDeaths(
        game: ActiveGame,
        participants: CombatParticipants,
        attackerId: string,
        defenderId: string,
    ): CombatDeathResolution {
        const attackerKilled = participants.attacker.character.life <= 0;
        const defenderKilled = participants.defender.character.life <= 0;

        let attackerNewPosition: Vec2 | null = null;
        let defenderNewPosition: Vec2 | null = null;

        if (attackerKilled) {
            participants.attacker.lossCount++;
            attackerNewPosition = this.resetLoserPosition(game, attackerId);
            participants.attacker.character.life = this.getMaxLife(participants.attacker);
        }

        if (defenderKilled) {
            participants.defender.lossCount++;
            defenderNewPosition = this.resetLoserPosition(game, defenderId);
            participants.defender.character.life = this.getMaxLife(participants.defender);
        }

        let winnerId: string | null = null;
        let loserId: string | null = null;

        if (attackerKilled && !defenderKilled) {
            winnerId = defenderId;
            loserId = attackerId;
            participants.defender.winsCount++;
        } else if (defenderKilled && !attackerKilled) {
            winnerId = attackerId;
            loserId = defenderId;
            participants.attacker.winsCount++;
        }

        return {
            attackerKilled,
            defenderKilled,
            winnerId,
            loserId,
            attackerNewPosition,
            defenderNewPosition,
        };
    }

    checkWinCondition(game: ActiveGame): Player | null {
        return game.lobby.players.find((player) => player.winsCount >= VICTORIES_TO_WIN) || null;
    }

    private resetLoserPosition(game: ActiveGame, loserId: string): Vec2 | null {
        const startPos = game.playerStartPositions.get(loserId);
        if (!startPos) return null;

        if (!this.isOccupied(game, startPos, loserId)) {
            game.playerPositions.set(loserId, { ...startPos });
            return { ...startPos };
        }

        const fallback = this.findClosestValidTile(game, startPos, loserId);
        if (fallback) {
            game.playerPositions.set(loserId, { ...fallback });
        }
        return fallback;
    }

    private findClosestValidTile(game: ActiveGame, origin: Vec2, excludeSocketId: string): Vec2 | null {
        const grid = game.lobby.game.grid;
        const visited = new Set<string>();
        const queue: Vec2[] = [origin];
        visited.add(`${origin.x},${origin.y}`);

        while (queue.length > 0) {
            const current = queue.shift();

            for (const offset of Object.values(DIRECTION_OFFSETS)) {
                const next: Vec2 = { x: current.x + offset.x, y: current.y + offset.y };
                const key = `${next.x},${next.y}`;

                if (visited.has(key)) continue;
                visited.add(key);

                if (next.y < 0 || next.y >= grid.length || next.x < 0 || next.x >= grid[0].length) continue;

                const tile = grid[next.y][next.x];
                if (TILE_COSTS[tile.type] === Infinity) continue;

                if (!this.isOccupied(game, next, excludeSocketId)) {
                    return next;
                }

                queue.push(next);
            }
        }
        return null;
    }

    private isOccupied(game: ActiveGame, pos: Vec2, excludeSocketId: string): boolean {
        for (const [socketId, playerPos] of game.playerPositions) {
            if (socketId === excludeSocketId) continue;
            if (playerPos.x === pos.x && playerPos.y === pos.y) return true;
        }
        return false;
    }

    private getPostureBonus(posture: Posture | undefined, postureType: PostureType): number {
        if (!posture || !posture.type) return 0;
        return posture.type === postureType ? COMBAT_CONSTANTS.postureBonusValue : 0;
    }

    private rollDice(dice: string, mode: DiceRollMode = DiceRollMode.Random): number {
        const faces = Number(dice[COMBAT_CONSTANTS.diceFaceIndex]);
        if (mode === DiceRollMode.Max) return faces;
        if (mode === DiceRollMode.Min) return COMBAT_CONSTANTS.diceMinValue;
        return Math.floor(Math.random() * faces) + COMBAT_CONSTANTS.diceMinValue;
    }

    private getIcePenalty(game: ActiveGame, socketId: string): 2 | 0 {
        const position = game.playerPositions.get(socketId);
        if (!position) return 0;

        const tile = game.lobby.game.grid[position.y]?.[position.x];
        if (!tile) return 0;

        return tile.type === TileTexture.Ice ? (COMBAT_CONSTANTS.icePenaltyValue as 2) : 0;
    }

    private buildStat(input: StatInput) {
        const { base, postureBonus, diceBonus, penalty } = input;
        const total = Math.max(base + postureBonus + diceBonus - penalty, 0);
        return { base, postureBonus, diceBonus, penalty, total };
    }

    private getMaxLife(player: Player): number {
        return player.character.lifeBonus ? BASE_STATS.life + BASE_STATS.bonus : BASE_STATS.life;
    }
}
