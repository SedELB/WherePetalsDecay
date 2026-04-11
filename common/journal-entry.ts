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
    FlagPickedUp = 'flagPickedUp',
    GameOver = 'gameOver',
}

export const journalEventTranslations = {
    [JournalEventType.TurnStart]: 'Début de tour',
    [JournalEventType.CombatStart]: 'Début de combat', 
    [JournalEventType.CombatEnd]: 'Fin de combat',
    [JournalEventType.CombatAttackDetail]: 'Attaque',
    [JournalEventType.CombatDefenseDetail]: 'Défense',
    [JournalEventType.CombatDamageResult]: 'Résultat de combat',
    [JournalEventType.DoorOpen]: 'Ouverture de porte',
    [JournalEventType.DoorClose]: 'Fermeture de porte',
    [JournalEventType.SanctuaryUsed]: 'Sanctuaire utilisé',
    [JournalEventType.DebugToggle]: 'Mode Debug',
    [JournalEventType.PlayerAbandon]: 'Abandon de joueur',
    [JournalEventType.FlagTransfer]: 'Transfert de drapeau',
    [JournalEventType.FlagPickedUp]: 'Ramassage de drapeau',
    [JournalEventType.GameOver]: 'Partie terminée',
};

export interface JournalEntry {
    timestamp: Date;
    eventType: JournalEventType;
    playerNames: string[];
    message: string;
    isPrivate: boolean;
    involvedPlayerIds: string[];
}
