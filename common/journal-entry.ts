export enum JournalEventType {
    TurnStart = 'turnStart',
    CombatStart = 'combatStart',
    CombatEnd = 'combatEnd',
    CombatAttackDetail = 'combatAttackDetail',
    CombatDefenseDetail = 'combatDefenseDetail',
    CombatDamageResult = 'combatDamageResult',
    DoorOpen = 'doorOpen',
    DoorClose = 'doorClose',
    SanctuaryUsed = 'sanctuaryUsed',
    DebugToggle = 'debugToggle',
    PlayerAbandon = 'playerAbandon',
    FlagTransfer = 'flagTransfer',
    GameOver = 'gameOver',
}

export interface JournalEntry {
    timestamp: Date;
    eventType: JournalEventType;
    playerNames: string[];
    message: string;
    isPrivate: boolean;
    involvedPlayerIds: string[];
}
