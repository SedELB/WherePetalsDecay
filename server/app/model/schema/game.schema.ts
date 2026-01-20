import { Prop, Schema, SchemaFactory} from '@nestjs/mongoose';

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

    @Prop({type: [[Number]], required: true}) // verifie que le array dans le array contient un number.
    grid: number[][];

}

export const GameSchema = SchemaFactory.createForClass(Game);