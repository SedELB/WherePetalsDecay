// gameService messages
export const GAME_NAME_NOT_UNIQUE = "Le nom du jeu n'est pas unique !";
export const NO_GAMES_FOUND = 'Aucun jeu trouvé dans la base de données';
export const GAME_NOT_FOUND = 'Aucun jeu trouvé avec cet identifiant';
export const NO_VISIBLE_GAMES_FOUND = 'Aucun jeu visible trouvé dans la base de données';
export const GAME_DELETION_FAILED = 'Erreur lors de la suppression du jeu';
export const GAME_VISIBILITY_UPDATE_FAILED = 'Echec lors de la mise à jour de la visibilité du jeu';

// gameValidator messages
export const NAME_FIELD_EMPTY = 'Le champ nom est vide !';
export const NAME_FIELD_TOO_LONG = 'Le champ nom dépasse la longueur maximale !';
export const DESCRIPTION_FIELD_EMPTY = 'Le champ description est vide !';
export const DESCRIPTION_FIELD_TOO_LONG = 'Le champ description dépasse la longueur maximale !';
export const INSUFFICIENT_TERRAIN_TILES = 'Moins de 50% des tuiles sont des tuiles de terrain !';
export const SPAWN_POINTS_NOT_PLACED = 'Tous les points de spawn ne sont pas placés !';
export const NO_TERRAIN_TILES = "Il n'y a pas de tuiles de terrain !";
export const UNREACHABLE_TILES = 'Une ou plusieurs tuiles sont inaccessibles !';
export const DOOR_ON_GRID_BORDER = 'ne peut pas être sur le bord de la carte !';
export const INVALID_DOOR_PLACEMENT = 'Placement de porte invalide à la position';
export const DESC_INVALID_DOOR_PLACEMENT = 'Une porte ne doit pas être bloquée par un obstacle (porte ou mur)';
export const DESC_INVALID_DOOR_PLACEMENT_2 = 'Une porte doit etre entre des murs et ne pas etre bloquee ';
export const FLAG_NOT_PLACED = "Le drapeau n'est pas placé !";
export const HEALING_SANCTUARIES_NOT_PLACED = 'Le nombre requis de sanctuaires de soin est pas atteint !';
export const COMBAT_SANCTUARIES_NOT_PLACED = 'Le nombre requis de sanctuaires de combat est pas atteint !';
