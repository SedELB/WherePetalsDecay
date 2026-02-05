import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { Game } from '@app/model/schema/game.schema';
import { GameService } from '@app/services/game/game.service';
import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

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
            response.status(HttpStatus.NOT_FOUND).json(error.message);
        }
    }

    @ApiOkResponse({
        description: 'Returns all visible games',
        type: Game,
        isArray: true,
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails.',
    })
    @Get('/visibleGames')
    async visibleGames(@Res() response: Response) {
        try {
            const allVisibleGames = await this.gameService.getAllVisibleGames();
            response.status(HttpStatus.OK).json(allVisibleGames);
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).json(error.message);
        }
    }

    @ApiCreatedResponse({
        description: 'Add new game',
        })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    @Post('/addGame')
    async addGame(@Body() gameDto: CreateGameDto, @Res() response: Response) {
        try {
            await this.gameService.addGame(gameDto);
            response.status(HttpStatus.CREATED).json();
        } catch (error) {
            response.status(HttpStatus.BAD_REQUEST).json(error.message);
        }
    }

    @ApiOkResponse({
            description: 'Modify a game',
            type: Game,
        })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    @Patch('/modifyGame/:id')
    async modifyGame(@Param('id') id: string, @Body() gameDto: UpdateGameDto, @Res() response: Response) {
        try {
            await this.gameService.modifyGame(id, gameDto);
            response.status(HttpStatus.OK).json('Game updated successfully!');
        } catch (error) {
            const status = error.message.includes('No game found with this id') ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            response.status(status).json(error.message);
        }
    }

    @ApiOkResponse({
        description: 'Modify a game visibility',
    })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    @Patch('/modifyVisibility/:id')
    async modifyVisibility(@Param('id') id: string, @Body('isVisible') isVisible: boolean, @Res() response: Response): Promise<void> {
        try {
            await this.gameService.updateVisibility(id, isVisible);
            response.status(HttpStatus.OK).json('Game updated successfully!');
        } catch (error) {
            response.status(HttpStatus.BAD_REQUEST).json(error.message);
        }
    }

    @ApiOkResponse({
            description: 'Delete a game',
            type: Game,
        })
    @ApiNotFoundResponse({
        description: 'Return NOT_FOUND http status when request fails',
    })
    @Delete('/:id') 
    async deleteGame(@Param('id') id: string, @Res() response: Response) {
        try {
            await this.gameService.deleteGame(id);
            response.status(HttpStatus.NO_CONTENT).json();
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).send(error.message);
        }
    }
}