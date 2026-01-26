import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GameMode, TileType, DoorState, TileItem } from '@app/model/schema/game.constants';


// TILE — sous-schéma (case)

@Schema({ _id: false }) // pas d'_id pour chaque case, une tuile nexiste pas seule
export class Tile {
    @Prop({ enum: TileType, required: true})
    type: TileType;

    @Prop({enum: TileItem, default: null})
    item?: TileItem | null;

    @Prop({enum : DoorState})
    doorState?: DoorState;
}

// export const tileSchema = SchemaFactory.createForClass(Tile); // si on separe dans un nouveau fichier


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

    @Prop({ enum: GameMode, required: true })
    gameMode: GameMode;

    @Prop({ required: true })
    thumbnail: string;
    
    @Prop({ required: true, min: 2, max: 6})
    maxPlayers: number;
    
    @Prop({ type: [[Tile]], required: true })
    grid: Tile[][];

    @Prop({ default: false })
    isVisible: boolean;

    // On utilise dorenavant { timestamps: true }

    // @Prop({ default: Date.now })
    // creationDate: Date;

    // @Prop({ default: Date.now })
    // lastModified: Date;
}

export const gameSchema = SchemaFactory.createForClass(Game);