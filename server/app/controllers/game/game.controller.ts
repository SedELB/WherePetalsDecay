import { CreateGameDto } from "@app/model/dto/game/create-game.dto";
import { Game } from "@app/model/schema/game.schema";
import { GameService } from "@app/services/game/game.service";
import { Body, Controller, Get, HttpStatus, Patch, Post, Res } from "@nestjs/common";
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { response, Response } from 'express';

@ApiTags('Games')
@Controller('game')
export class GameController {
    constructor(private readonly gameService: GameService) {}

    @ApiOkResponse({
        description: 'Returns all games',
        type: Game,
        isArray: true,
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails.',
    })
    @Get('/games')
    async allGames(@Res() response: Response) {
        try {
            const allGames = await this.gameService.getAllGames();
            response.status(HttpStatus.OK).json(allGames);
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }

    @ApiCreatedResponse({
            description: 'Add new game',
        })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    @Post('/game')
    async addGame(@Body() gameDto: CreateGameDto, @Res() response: Response) {
        try {
            await this.gameService.addGame(gameDto);
            response.status(HttpStatus.CREATED).send();
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }

    @ApiOkResponse({
            description: 'Modify a game',
            type: Game,
        })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    @Patch('/game')
    async modifyGame(@Body() gameDto: CreateGameDto, @Res() response: Response) {
        try {
            await this.gameService.modifyGame(gameDto);
            response.status(HttpStatus.OK).send();
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }
}