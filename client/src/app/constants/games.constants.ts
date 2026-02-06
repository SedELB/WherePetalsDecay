import { GameCard } from '@app/interfaces/game';

export const AVAILABLE_GAMES: readonly GameCard[] = [
  {
    id: 1, image: '/assets/filler.png', name: 'Game 1', size: { rows: 10, cols: 10 },
    mode: 'Solo', date: '2026-01-01', visible: true,
    imgDescription: 'blablabladsssssssssmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm'
  },
  { id: 2, image: '/assets/filler.png', name: 'Game 2', size: { rows: 20, cols: 20 }, mode: 'Solo', date: '2026-01-05', visible: true, imgDescription: 'blablabla' },
  { id: 3, image: '/assets/filler.png', name: 'Game 3', size: { rows: 5, cols: 5 }, mode: 'Co-op', date: '2026-01-10', visible: true, imgDescription: 'blablabla' },
] as const;
