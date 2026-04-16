import { Injectable, signal } from '@angular/core';
import { DEFAULT_DICE_FACES, DICE_ROLL_TICK_MS } from '@app/components/combat/combat.constants';
import {
    DiceRollDisplayData,
    FighterDiceDisplayData,
    FighterSide,
    RoundDetailedResult,
} from '@app/interfaces/combat.interfaces';
import { CombatStateService } from './combat-state.service';

@Injectable({
    providedIn: 'root',
})
export class CombatDiceService {
    readonly diceRollDisplay = signal<DiceRollDisplayData | null>(null);

    private diceRollInterval: ReturnType<typeof setInterval> | null = null;
    private diceRollTimeouts: ReturnType<typeof setTimeout>[] = [];

    constructor(private readonly combatState: CombatStateService) {}

    playDiceAnimation(
        sequenceToken: number,
        roundResult: RoundDetailedResult,
        durations: { rollMs: number; resultMs: number },
        debugDiceMode: boolean,
        onFinished: () => void,
    ): void {
        this.clearAnimations();
        this.combatState.isDiceRollInProgress.set(true);

        const player = this.combatState.player();
        const enemy = this.combatState.enemy();
        if (!player || !enemy) return;

        const pAtkFaces = this.getDiceFaces(player.character.attackDice);
        const pDefFaces = this.getDiceFaces(player.character.defenseDice);
        const eAtkFaces = this.getDiceFaces(enemy.character.attackDice);
        const eDefFaces = this.getDiceFaces(enemy.character.defenseDice);

        this.updateDiceDisplay(1, 1, 1, 1, false);

        this.diceRollInterval = setInterval(() => {
            if (this.combatState.activeRoundSequenceToken() !== sequenceToken) return;

            const pAtk = debugDiceMode ? roundResult.player.attack.dice : Math.floor(Math.random() * pAtkFaces) + 1;
            const pDef = debugDiceMode ? roundResult.player.defense.dice : Math.floor(Math.random() * pDefFaces) + 1;
            const eAtk = debugDiceMode ? roundResult.enemy.attack.dice : Math.floor(Math.random() * eAtkFaces) + 1;
            const eDef = debugDiceMode ? roundResult.enemy.defense.dice : Math.floor(Math.random() * eDefFaces) + 1;

            this.updateDiceDisplay(pAtk, pDef, eAtk, eDef, false);
        }, DICE_ROLL_TICK_MS);

        const settleTimeout = setTimeout(() => {
            if (this.combatState.activeRoundSequenceToken() !== sequenceToken) return;

            this.clearDiceRollInterval();
            this.updateDiceDisplay(
                roundResult.player.attack.dice,
                roundResult.player.defense.dice,
                roundResult.enemy.attack.dice,
                roundResult.enemy.defense.dice,
                true,
            );

            const resultTimeout = setTimeout(() => {
                if (this.combatState.activeRoundSequenceToken() !== sequenceToken) return;
                this.combatState.isDiceRollInProgress.set(false);
                this.diceRollDisplay.set(null);
                onFinished();
            }, durations.resultMs);

            this.diceRollTimeouts.push(resultTimeout);
        }, durations.rollMs);

        this.diceRollTimeouts.push(settleTimeout);
    }

    clearAnimations(): void {
        this.clearDiceRollInterval();
        this.diceRollTimeouts.forEach(clearTimeout);
        this.diceRollTimeouts = [];
        this.combatState.isDiceRollInProgress.set(false);
        this.diceRollDisplay.set(null);
    }

    private clearDiceRollInterval(): void {
        if (this.diceRollInterval) {
            clearInterval(this.diceRollInterval);
            this.diceRollInterval = null;
        }
    }

    private updateDiceDisplay(pAtk: number, pDef: number, eAtk: number, eDef: number, isFinal: boolean): void {
        this.diceRollDisplay.set({
            player: this.buildFighterDiceData(pAtk, pDef, 'player'),
            enemy: this.buildFighterDiceData(eAtk, eDef, 'enemy'),
            isFinal,
        });
    }

    private buildFighterDiceData(attackValue: number, defenseValue: number, side: FighterSide): FighterDiceDisplayData {
        const fighter = side === 'player' ? this.combatState.player() : this.combatState.enemy();
        return {
            fighterName: fighter?.character.name ?? '',
            attackFaces: this.getDiceFaces(fighter?.character.attackDice),
            defenseFaces: this.getDiceFaces(fighter?.character.defenseDice),
            attackValue,
            defenseValue,
        };
    }

    private getDiceFaces(notation: string | undefined): number {
        const faces = Number(notation?.slice(1));
        return Number.isFinite(faces) && faces > 0 ? faces : DEFAULT_DICE_FACES;
    }
}
