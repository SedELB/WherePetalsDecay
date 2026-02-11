import { DESC_MAX_LENGTH, MAX_PLAYERS_DTO, MIN_PLAYERS_DTO, NAME_MAX_LENGTH, TEXT_MIN_LENGTH } from '@app/utils/game.constants';
import { GameMode, TileItem, TileTexture } from '@app/utils/game.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;
// TILE — sous-schéma (case)

@Schema({ _id: false }) // pas d'_id pour chaque case, une tuile nexiste pas seule
export class Tile {
    @Prop({ type: String, enum: Object.values(TileTexture), required: true })
    type: TileTexture;

    @Prop({ type: String, enum: [...Object.values(TileItem), null], default: null })
    item: TileItem | null;
}

export const tileSchema = SchemaFactory.createForClass(Tile); // si on separe dans un nouveau fichier

// GAME — schéma principal

@Schema({ timestamps: true }) // ajoute et modifie createdAt et updatedAt automatiquement
export class Game {
    @Prop({ required: true, trim: true, minlength: TEXT_MIN_LENGTH, maxlength: NAME_MAX_LENGTH }) // trim gere les espaces vides pour un meilleur rendu
    name: string;

    @Prop({ required: true, trim: true, minlength: TEXT_MIN_LENGTH, maxlength: DESC_MAX_LENGTH })
    description: string;

    @Prop({ type: { rows: Number, cols: Number }, required: true, _id: false })
    size: {
        rows: number,
        cols: number
    };

    @Prop({ type: String, enum: Object.values(GameMode), required: true })
    gameMode: GameMode;

    @Prop({ required: true })
    thumbnail: string;

    @Prop({ required: true, min: MIN_PLAYERS_DTO, max: MAX_PLAYERS_DTO })
    maxPlayers: number;

    @Prop({ type: [[tileSchema]], required: true })
    grid: Tile[][];

    @Prop({ default: false })
    isVisible: boolean;
}

export const gameSchema = SchemaFactory.createForClass(Game);