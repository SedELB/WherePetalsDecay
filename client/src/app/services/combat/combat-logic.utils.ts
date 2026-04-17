import { TO_PERCENT } from '@app/components/combat/combat.constants';
import { FighterSide, FighterStatType, RoundDetailedResult, RoundLifeResults } from '@app/interfaces/combat.interfaces';
import { BASE_STATS } from '@common/constants/character.constants';
import { PostureType } from '@common/enums';
import { CombatFighterResult, CombatResult } from '@common/interfaces/game-view';
import { Player } from '@common/player';

export const getOriginalMaxLife = (fighter: Player | null): number => {
    return fighter?.character ? BASE_STATS.life + (fighter.character.lifeBonus ? BASE_STATS.bonus : 0) : BASE_STATS.life;
};

export const getLifeProgressPercent = (displayedLife: number, maxLife: number): number => {
    return maxLife > 0 ? (displayedLife / maxLife) * TO_PERCENT : 0;
};

export const getStatFromResult = (side: FighterSide, stat: FighterStatType, roundResult: RoundDetailedResult | null) => {
    const fRes = side === 'player' ? roundResult?.player : roundResult?.enemy;
    return stat === 'attack' ? fRes?.attack : fRes?.defense;
};

export const getPostureBonus = (
    side: FighterSide,
    stat: FighterStatType,
    fighter: Player | null,
    roundResult: RoundDetailedResult | null,
    postureBonusValue: number,
): number => {
    const result = getStatFromResult(side, stat, roundResult);
    if (result) return result.postureBonus;
    const type = fighter?.character?.bonusPosture?.type;
    return (stat === 'attack' && type === PostureType.Attack) || (stat === 'defense' && type === PostureType.Defense) ? postureBonusValue : 0;
};

export const getIceDebuff = (
    side: FighterSide,
    stat: FighterStatType,
    fighter: Player | null,
    roundResult: RoundDetailedResult | null,
): number => {
    const result = getStatFromResult(side, stat, roundResult);
    if (result) return result.penalty;
    return fighter?.character?.debuf ?? 0;
};

export const getStatTotal = (
    side: FighterSide,
    stat: FighterStatType,
    fighter: Player | null,
    roundResult: RoundDetailedResult | null,
    postureBonusValue: number,
): number => {
    const result = getStatFromResult(side, stat, roundResult);
    if (result) return result.total;
    const base = stat === 'attack' ? fighter?.character?.attack : fighter?.character?.defense;
    return (base ?? 0) + getPostureBonus(side, stat, fighter, roundResult, postureBonusValue) - getIceDebuff(side, stat, fighter, roundResult);
};

export const mapFighterResult = (f: CombatFighterResult) => {
    return {
        attack: {
            base: f.attack.base,
            postureBonus: f.attack.postureBonus,
            dice: f.attack.diceBonus,
            penalty: f.attack.penalty,
            total: f.attack.total,
        },
        defense: {
            base: f.defense.base,
            postureBonus: f.defense.postureBonus,
            dice: f.defense.diceBonus,
            penalty: f.defense.penalty,
            total: f.defense.total,
        },
    };
};


export const calculateRoundLifeResults = (
    result: CombatResult,
    playerSocketId: string,
): RoundLifeResults => {
    const localIsAtk = result.attacker.socketId === playerSocketId;
    const local = localIsAtk ? result.attacker : result.defender;
    const remote = localIsAtk ? result.defender : result.attacker;

    return {
        playerLife: local.killed ? 0 : Math.max(0, local.lifeAfter),
        enemyLife: remote.killed ? 0 : Math.max(0, remote.lifeAfter),
        playerDamage: local.damageDealt,
        enemyDamage: remote.damageDealt,
        local,
        remote,
    };
};


export const getDiceBonus = (side: FighterSide, stat: FighterStatType, roundResult: RoundDetailedResult | null): number => {
    return getStatFromResult(side, stat, roundResult)?.dice ?? 0;
};

export const getPostureStatusValue = (fighter: Player | null): string => {
    const type = fighter?.character?.bonusPosture?.type;
    return type === PostureType.Attack ? '⚔️ Offensive' : type === PostureType.Defense ? '🛡️ Défensive' : '⏳ Neutre';
};

export const getFighterName = (id: string | null, player: Player | null, enemy: Player | null): string => {
    if (!id) return 'Joueur';
    const fighter = id === player?.socketId ? player : enemy;
    return fighter?.character?.name ?? 'Joueur';
};
