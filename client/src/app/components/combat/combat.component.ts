import { NgClass } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';
import { IsometricMapComponent } from '@app/components/isometric-map/isometric-map.component';
import {
    CombatLogicService,
    FighterSide,
    FighterStatType,
    TypePosture,
} from '@app/services/combat/combat-logic.service';
import { Player } from '@common/player';

@Component({
    selector: 'app-combat',
    imports: [ButtonComponent, IsometricMapComponent, NgClass],
    templateUrl: './combat.component.html',
    styleUrl: './combat.component.scss',
    providers: [CombatLogicService],
})
export class CombatComponent implements OnChanges, OnInit, OnDestroy {
    @Input() player!: Player;
    @Input() enemy!: Player;

    constructor(private readonly combatLogicService: CombatLogicService) {}

    get playerPos() {
        return this.combatLogicService.playerPos;
    }

    get combatStartPopup() {
        return this.combatLogicService.combatStartPopup;
    }

    get combatEndPopup() {
        return this.combatLogicService.combatEndPopup;
    }

    get roundAnnouncementPopup() {
        return this.combatLogicService.roundAnnouncementPopup;
    }

    get damagePopup() {
        return this.combatLogicService.damagePopup;
    }

    get diceRollDisplay() {
        return this.combatLogicService.diceRollDisplay;
    }

    get impactDamagePopups() {
        return this.combatLogicService.impactDamagePopups;
    }

    get combatMap() {
        return this.combatLogicService.combatMap;
    }

    getCurrentRoundIndex(): number {
        return this.combatLogicService.getCurrentRoundIndex();
    }

    getPostureCountdown(): number {
        return this.combatLogicService.getPostureCountdown();
    }

    getPostureCountdownProgressPercent(): number {
        return this.combatLogicService.getPostureCountdownProgressPercent();
    }

    isPostureCountdownVisible(): boolean {
        return this.combatLogicService.isPostureCountdownVisible();
    }

    shouldShowAttackAnnouncement(): boolean {
        return this.combatLogicService.shouldShowAttackAnnouncement();
    }

    getAttackAnnouncementMessage(): string {
        return this.combatLogicService.getAttackAnnouncementMessage();
    }

    isPosturePending(fighter: Player): boolean {
        return this.combatLogicService.isPosturePending(fighter);
    }

    getPostureStatusValue(fighter: Player): string {
        return this.combatLogicService.getPostureStatusValue(fighter);
    }

    getStatTotal(side: FighterSide, stat: FighterStatType): number {
        return this.combatLogicService.getStatTotal(side, stat);
    }

    getPostureBonus(side: FighterSide, stat: FighterStatType): number {
        return this.combatLogicService.getPostureBonus(side, stat);
    }

    getDiceBonus(side: FighterSide, stat: FighterStatType): number {
        return this.combatLogicService.getDiceBonus(side, stat);
    }

    getDiceBonusDisplay(side: FighterSide, stat: FighterStatType): string {
        return this.combatLogicService.getDiceBonusDisplay(side, stat);
    }

    getIceDebuff(side: FighterSide, stat: FighterStatType): number {
        return this.combatLogicService.getIceDebuff(side, stat);
    }

    getIceDebuffDisplay(side: FighterSide, stat: FighterStatType): string {
        return this.combatLogicService.getIceDebuffDisplay(side, stat);
    }

    getDisplayedLife(side: FighterSide): number {
        return this.combatLogicService.getDisplayedLife(side);
    }

    getOriginalMaxLife(side: FighterSide): number {
        return this.combatLogicService.getOriginalMaxLife(side);
    }

    getLifeProgressPercent(side: FighterSide): number {
        return this.combatLogicService.getLifeProgressPercent(side);
    }

    isFighterDead(side: FighterSide): boolean {
        return this.combatLogicService.isFighterDead(side);
    }

    shouldShowPosturePanel(): boolean {
        return this.combatLogicService.shouldShowPosturePanel();
    }

    choosePosture(posture: TypePosture): void {
        this.combatLogicService.choosePosture(posture);
    }

    ngOnInit(): void {
        this.combatLogicService.initialize();
    }

    ngOnDestroy(): void {
        this.combatLogicService.dispose();
    }

    get combatFlipMap(): Record<string, boolean> {
        const flipMap: Record<string, boolean> = {};
        if (this.player?.socketId) flipMap[this.player.socketId] = true;
        return flipMap;
    }

    ngOnChanges(): void {
        if (!this.player?.socketId || !this.enemy?.socketId) return;
        this.combatLogicService.setCombatants(this.player, this.enemy);
        this.combatLogicService.syncStateWithInputs();
    }
}
