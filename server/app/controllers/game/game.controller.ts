import { AdminGateway } from '@app/gateways/admin/admin.gateway';
import { GameCatalogGateway } from '@app/gateways/game-catalog/game-catalog.gateway';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { GameService } from '@app/services/game/game.service';
import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Games')
@Controller('game')
export class GameController {
    constructor(
        private readonly gameService: GameService,
        private readonly adminGateway: AdminGateway,
        private readonly gameCatalogGateway: GameCatalogGateway,
    ) {}

    @Get('/allGames')
    async allGames(@Res() response: Response) {
        try {
            const allGames = await this.gameService.getAllGames();
            response.status(HttpStatus.OK).json(allGames);
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).json(error.message);
        }
    }

    @Get('/singleGame/:id')
    async getGame(@Param('id') id: string, @Res() response: Response) {
        try {
            const game = await this.gameService.getGameById(id);
            response.status(HttpStatus.OK).json(game);
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).json(error.message);
        }
    }

    @Get('/visibleGames')
    async visibleGames(@Res() response: Response) {
        try {
            const allVisibleGames = await this.gameService.getAllVisibleGames();
            response.status(HttpStatus.OK).json(allVisibleGames);
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).json(error.message);
        }
    }

    @Post('/addGame')
    async addGame(@Body() gameDto: CreateGameDto, @Res() response: Response) {
        try {
            const createdGame = await this.gameService.addGame(gameDto);
            this.adminGateway.notifyGameCreated(createdGame);
            if (createdGame.isVisible) {
                this.gameCatalogGateway.notifyGameCreated(createdGame);
            }
            response.status(HttpStatus.CREATED).json('Le jeu a été créé avec succès !');
        } catch (error) {
            response.status(HttpStatus.BAD_REQUEST).json(error.message);
        }
    }

    @Patch('/modifyGame/:id')
    async modifyGame(@Param('id') id: string, @Body() gameDto: UpdateGameDto, @Res() response: Response) {
        try {
            const updatedGame = await this.gameService.modifyGame(id, gameDto);
            this.adminGateway.notifyGameUpdated(updatedGame);

            // Notify others to hide the game
            if (!updatedGame.isVisible) {
                this.gameCatalogGateway.notifyGameDeleted(id);
            }

            response.status(HttpStatus.OK).json('Le jeu a été modifié avec succès !');
        } catch (error) {
            const status = error.message.includes('Aucun jeu trouvé avec cet identifiant.') ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            response.status(status).json(error.message);
        }
    }

    @Patch('/modifyVisibility/:id')
    async modifyVisibility(@Param('id') id: string, @Body('isVisible') isVisible: boolean, @Res() response: Response): Promise<void> {
        try {
            const updatedGame = await this.gameService.updateVisibility(id, isVisible);
            this.adminGateway.notifyGameVisibilityChanged(id, isVisible);

            if (isVisible) {
                this.gameCatalogGateway.notifyGameCreated(updatedGame);
            } else {
                this.gameCatalogGateway.notifyGameDeleted(id);
            }

            response.status(HttpStatus.OK).json('Le jeu a été modifié avec succès !');
        } catch (error) {
            response.status(HttpStatus.BAD_REQUEST).json(error.message);
        }
    }

    @Delete('/:id')
    async deleteGame(@Param('id') id: string, @Res() response: Response) {
        try {
            await this.gameService.deleteGame(id);
            this.adminGateway.notifyGameDeleted(id);
            this.gameCatalogGateway.notifyGameDeleted(id);
            response.status(HttpStatus.NO_CONTENT).json('Le jeu a été supprimé avec succès !');
        } catch (error) {
            response.status(HttpStatus.NOT_FOUND).json(error.message);
        }
    }
}