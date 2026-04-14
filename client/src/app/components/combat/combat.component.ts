import { NgClass, NgStyle } from '@angular/common';
import { Component, effect, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';
import { IsometricMapComponent } from '@app/components/isometric-map/isometric-map.component';
import { GameViewService } from '@app/services/game-view/game-view.service';
import { Posture } from '@common/character';
import { TileTexture } from '@common/enums';
import { CombatAttackAnimationData } from '@common/interfaces/game-view';
import { Player } from '@common/player';
import { Tile } from '@common/tile';
import { Vec2 } from '@common/vec2';
import swal from 'sweetalert2';

import {
  TypePosture,
  RoundDetailedResult,
  POSTURE_BONUS,
  START_TOAST_TIMER,
  COMBAT_ATTACK_ANIMATION_DEFAULT_MS,
  COMBAT_ANIMATION_PHASE_COUNT,
  COMBAT_ANIMATION_MIN_STEP_MS,
  COMBAT_ANIMATION_DEFENDER_STEP_MULTIPLIER,
  COMBAT_ANIMATION_DEFENDER_HIT_MULTIPLIER,
  COMBAT_ANIMATION_DEFENDER_BACK_MULTIPLIER,
  COMBAT_ANIMATION_RESET_MULTIPLIER,
  TILE_CENTER_OFFSET,
  TO_PERCENT,
  ROUND_RESULT_TOAST_TIMER,
  TOAST_DEFAULT_TIMER,
  getBaseCombatPositions,
  computeLungePosition,
} from '@app/components/combat/combat.helper';

@Component({
  selector: 'app-combat',
  imports: [ButtonComponent, IsometricMapComponent, NgClass, NgStyle],
  templateUrl: './combat.component.html',
  styleUrl: './combat.component.scss',
})

export class CombatComponent implements OnChanges, OnInit, OnDestroy {

  @Input() player!: Player;
  @Input() enemy!: Player;

  playerPos: Record<string, Vec2> = {};
  isChoosingPosture = false;
  roundResult: RoundDetailedResult | null = null;
  activeHitTargetSocketId: string | null = null;

  private duelKey = '';
  private hasShownStartPopup = false;
  private hasShownWaitingPopup = false;
  private lastEnemyPostureType: TypePosture = null;
  private rollCount = 0;
  private lastAppliedResultKey = '';
  private lastAttackAnimationSequence = 0;
  private queuedAttackAnimation: CombatAttackAnimationData | null = null;
  private attackAnimationTimeouts: ReturnType<typeof setTimeout>[] = [];
  readonly combatMap: Tile[][] = [
    [{ type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }],
    [{ type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }],
    [{ type: TileTexture.Wall, item: null }, { type: TileTexture.Floor, item: null }, { type: TileTexture.Wall, item: null }],
  ];

  constructor(private readonly gameViewService: GameViewService) {
    effect(() => {
      const payload = this.gameViewService.combatAttackAnimation();
      if (!payload) return;
      if (payload.sequence === this.lastAttackAnimationSequence) return;

      this.lastAttackAnimationSequence = payload.sequence;
      this.queuedAttackAnimation = payload.data;
      this.tryPlayQueuedAttackAnimation();
    });
  }

  getCurrentRoundIndex(): number {
    return this.gameViewService.combatRoundIndex();
  }

  getPostureCountdown(): number {
    return this.gameViewService.combatPostureCountdown();
  }

  ngOnInit(): void {
    this.isChoosingPosture = true;
  }

  ngOnDestroy(): void {
    this.clearAttackAnimationTimeouts();
  }

  ngOnChanges(): void {
    if (!this.player?.socketId || !this.enemy?.socketId) return;

    this.initializeDuelIfNeeded();

    this.playerPos = getBaseCombatPositions(this.enemy.socketId, this.player.socketId);

    this.isChoosingPosture = !this.hasChosenPosture(this.player);
    if (this.isChoosingPosture) {
      this.hasShownWaitingPopup = false;
    }

    const enemyPostureType = this.enemy.character.bonusPosture?.type ?? null;
    if (!enemyPostureType) {
      this.lastEnemyPostureType = null;
    } else if (enemyPostureType !== this.lastEnemyPostureType) {
      this.showToast('Posture adverse reçue. Le lancé de dés est disponible.', 'info');
      this.lastEnemyPostureType = enemyPostureType;
    }

    this.tryPlayQueuedAttackAnimation();
    this.applyLatestServerResult();
  }

  choosePosture(posture: TypePosture): void {
    if (!this.isChoosingPosture || !posture) return;

    this.player.character.bonusPosture = { type: posture, bonus: POSTURE_BONUS };
    this.isChoosingPosture = false;
    this.showToast(`Posture ${posture === 'atk' ? 'offensive' : 'défensive'} choisie.`, 'success');

    const lobbyId = this.gameViewService.gameLobby()?.lobbyId;
    const roomId = this.gameViewService.getCurrentCombatRoomId();
    if (!lobbyId || !roomId) return;

    this.gameViewService.sendPostureChoice(lobbyId, roomId, this.player.character.bonusPosture as Posture);

    if (!this.hasShownWaitingPopup) {
      this.hasShownWaitingPopup = true;
      this.showToast('En attente de la posture adverse...', 'info');
    }
  }

  private initializeDuelIfNeeded(): void {
    const newKey = `${this.player.socketId}:${this.enemy.socketId}`;
    if (newKey === this.duelKey) return;

    this.duelKey = newKey;
    this.hasShownStartPopup = false;
    this.hasShownWaitingPopup = false;
    this.lastEnemyPostureType = this.enemy.character.bonusPosture?.type ?? null;
    this.roundResult = null;
    this.activeHitTargetSocketId = null;
    this.rollCount = 0;
    this.lastAppliedResultKey = '';

    if (!this.hasChosenPosture(this.player)) {
      this.player.character.bonusPosture = { type: null, bonus: 0 };
    }

    this.isChoosingPosture = !this.hasChosenPosture(this.player);

    if (!this.hasShownStartPopup) {
      this.hasShownStartPopup = true;
      this.showToast(
        'Combat lancé',
        'info',
        `<span>${this.player.character.name} affronte ${this.enemy.character.name}. Choisissez votre posture.</span>`,
        START_TOAST_TIMER,
      );
    }
  }

  private hasChosenPosture(fighter: Player): boolean {
    return Boolean(fighter.character.bonusPosture?.type);
  }

  private tryPlayQueuedAttackAnimation(): void {
    const animation = this.queuedAttackAnimation;
    if (!animation || !this.player?.socketId || !this.enemy?.socketId) return;

    const isCurrentDuel = [this.player.socketId, this.enemy.socketId].includes(animation.attackerSocketId) &&
      [this.player.socketId, this.enemy.socketId].includes(animation.defenderSocketId);
    if (!isCurrentDuel) {
      this.queuedAttackAnimation = null;
      return;
    }

    const basePositions = getBaseCombatPositions(this.enemy.socketId, this.player.socketId);
    const attackerBasePosition = basePositions[animation.attackerSocketId];
    const defenderBasePosition = basePositions[animation.defenderSocketId];
    if (!attackerBasePosition || !defenderBasePosition) {
      this.queuedAttackAnimation = null;
      return;
    }

    const attackerLungePosition = computeLungePosition(attackerBasePosition, defenderBasePosition);
    const defenderLungePosition = computeLungePosition(defenderBasePosition, attackerBasePosition);
    const totalDurationMs = animation.durationMs > 0 ? animation.durationMs : COMBAT_ATTACK_ANIMATION_DEFAULT_MS;
    const stepDurationMs = Math.max(COMBAT_ANIMATION_MIN_STEP_MS, Math.floor(totalDurationMs / COMBAT_ANIMATION_PHASE_COUNT));

    this.clearAttackAnimationTimeouts();
    this.activeHitTargetSocketId = null;

    this.playerPos = {
      ...basePositions,
      [animation.attackerSocketId]: attackerLungePosition,
    };

    const attackerHitTimeout = setTimeout(() => {
      this.activeHitTargetSocketId = animation.defenderSocketId;
    }, stepDurationMs);

    const attackerBackTimeout = setTimeout(() => {
      this.activeHitTargetSocketId = null;
      this.playerPos = { ...basePositions };
    }, stepDurationMs * 2);

    const defenderStepTimeout = setTimeout(() => {
      this.playerPos = {
        ...basePositions,
        [animation.defenderSocketId]: defenderLungePosition,
      };
    }, stepDurationMs * COMBAT_ANIMATION_DEFENDER_STEP_MULTIPLIER);

    const defenderHitTimeout = setTimeout(() => {
      this.activeHitTargetSocketId = animation.attackerSocketId;
    }, stepDurationMs * COMBAT_ANIMATION_DEFENDER_HIT_MULTIPLIER);

    const defenderBackTimeout = setTimeout(() => {
      this.activeHitTargetSocketId = null;
      this.playerPos = { ...basePositions };
    }, stepDurationMs * COMBAT_ANIMATION_DEFENDER_BACK_MULTIPLIER);

    const resetTimeout = setTimeout(() => {
      this.playerPos = getBaseCombatPositions(this.enemy.socketId, this.player.socketId);
      this.activeHitTargetSocketId = null;
      this.attackAnimationTimeouts = [];
    }, stepDurationMs * COMBAT_ANIMATION_RESET_MULTIPLIER);

    this.attackAnimationTimeouts.push(
      attackerHitTimeout,
      attackerBackTimeout,
      defenderStepTimeout,
      defenderHitTimeout,
      defenderBackTimeout,
      resetTimeout,
    );

    this.queuedAttackAnimation = null;
  }
  private clearAttackAnimationTimeouts(): void {
    if (this.attackAnimationTimeouts.length === 0) return;
    this.attackAnimationTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.attackAnimationTimeouts = [];
  }

  getOverlayStyle(socketId: string): Record<string, string> {
    const position = this.playerPos[socketId] ?? getBaseCombatPositions(this.enemy?.socketId, this.player?.socketId)[socketId];
    if (!position) {
      return { left: '50%', top: '50%' };
    }

    const rowCount = this.combatMap.length;
    const colCount = this.combatMap[0]?.length ?? 1;
    const left = ((position.x + TILE_CENTER_OFFSET) / colCount) * TO_PERCENT;
    const top = ((position.y + TILE_CENTER_OFFSET) / rowCount) * TO_PERCENT;

    return {
      left: `${left}%`,
      top: `${top}%`,
    };
  }

  private applyLatestServerResult(): void {
    const result = this.gameViewService.lastCombatResult();
    if (!result) return;

    const isPlayerInvolved =
      (result.attacker.socketId === this.player.socketId && result.defender.socketId === this.enemy.socketId) ||
      (result.attacker.socketId === this.enemy.socketId && result.defender.socketId === this.player.socketId);
    if (!isPlayerInvolved) return;

    const resultKey = [
      result.attacker.socketId,
      result.defender.socketId,
      result.attacker.lifeAfter,
      result.defender.lifeAfter,
      result.attacker.damageDealt,
      result.defender.damageDealt,
    ].join(':');
    if (resultKey === this.lastAppliedResultKey) return;
    this.lastAppliedResultKey = resultKey;

    const localIsAttacker = result.attacker.socketId === this.player.socketId;
    const local = localIsAttacker ? result.attacker : result.defender;
    const enemy = localIsAttacker ? result.defender : result.attacker;

    this.rollCount++;
    this.roundResult = {
      player: {
        attack: {
          base: local.attack.base,
          postureBonus: local.attack.postureBonus,
          dice: local.attack.diceBonus,
          penalty: local.attack.penalty,
          total: local.attack.total,
        },
        defense: {
          base: local.defense.base,
          postureBonus: local.defense.postureBonus,
          dice: local.defense.diceBonus,
          penalty: local.defense.penalty,
          total: local.defense.total,
        },
      },
      enemy: {
        attack: {
          base: enemy.attack.base,
          postureBonus: enemy.attack.postureBonus,
          dice: enemy.attack.diceBonus,
          penalty: enemy.attack.penalty,
          total: enemy.attack.total,
        },
        defense: {
          base: enemy.defense.base,
          postureBonus: enemy.defense.postureBonus,
          dice: enemy.defense.diceBonus,
          penalty: enemy.defense.penalty,
          total: enemy.defense.total,
        },
      },
      damageDealt: local.damageDealt,
      damageReceived: enemy.damageDealt,
      rollIndex: this.rollCount,
    };

    this.showToast(
      `Résultat du lancé #${this.rollCount}`,
      'success',
      `
        <p><b>Dégâts infligés:</b> ${local.damageDealt}</p>
        <p><b>Dégâts subis:</b> ${enemy.damageDealt}</p>
      `,
      ROUND_RESULT_TOAST_TIMER,
    );
  }

  private showToast(
    title: string,
    icon: 'success' | 'info' | 'warning',
    html?: string,
    timer = TOAST_DEFAULT_TIMER,
  ): void {
    void swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      html,
      showConfirmButton: false,
      timer,
      timerProgressBar: true,
    });
  }

}
