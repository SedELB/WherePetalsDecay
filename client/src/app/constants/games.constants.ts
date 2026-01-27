import { Game } from '@app/interfaces/character';

export const AVAILABLE_GAMES: readonly Game[] = [
    {
        name: 'Donjon Sombre',
        size: 'Petite (10x10)',
        mode: 'Classique',
        lastModified: '26 janvier 2026',
    },
    {
        name: 'Forêt Enchantée',
        size: 'Moyenne (15x15)',
        mode: 'Classique',
        lastModified: '25 janvier 2026',
    },
    {
        name: 'Château Maudit',
        size: 'Grande (20x20)',
        mode: 'Classique',
        lastModified: '24 janvier 2026',
    },
] as const;
