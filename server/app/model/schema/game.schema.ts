import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GameMode, TileType, DoorState, TileItem } from '@app/model/schema/game.constants';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;
// TILE — sous-schéma (case)

@Schema({ _id: false }) // pas d'_id pour chaque case, une tuile nexiste pas seule
export class Tile {
    @Prop({ type: String, enum: Object.values(TileType), required: true})
    type: TileType;

    @Prop({ type: String, enum: Object.values(TileItem), default: null})
    item?: TileItem | null;

    @Prop({ type: String, enum : Object.values(DoorState)})
    doorState?: DoorState;
}

export const tileSchema = SchemaFactory.createForClass(Tile); // si on separe dans un nouveau fichier

// GAME — schéma principal

@Schema({ timestamps: true }) // ajoute et modifie createdAt et updatedAt automatiquement
export class Game {
    @Prop({ required: true, trim: true }) // trim gere les espaces vides pour un meilleur rendu
    name: string;

    @Prop({ required: true, trim: true })
    description: string;

    @Prop({ type: {rows: Number, cols: Number}, required: true })
    size: {
        rows: number, 
        cols: number
    };

    @Prop({ type: String, enum: Object.values(GameMode), required: true })
    gameMode: GameMode;

    @Prop({ required: true })
    thumbnail: string;
    
    @Prop({ required: true, min: 2, max: 6})
    maxPlayers: number;
    
    @Prop({ type: [[tileSchema]], required: true })
    grid: Tile[][];

    @Prop({ default: false })
    isVisible: boolean;
}

export const gameSchema = SchemaFactory.createForClass(Game);