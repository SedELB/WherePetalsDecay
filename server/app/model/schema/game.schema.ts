import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class Game {
    @Prop()
    name: string;

    @Prop()
    size: string;

    @Prop()
    id: string;

    @Prop()
    gameMode: string;

    @Prop()
    lastModified: Date;

    @Prop()
    thumbnail: string;

    @Prop({type: [[Object]], required: true}) // verifie que le array dans le array contient un number.
    grid: object[][];

    @Prop()
    isVisible: boolean;
}

export const gameSchema = SchemaFactory.createForClass(Game);