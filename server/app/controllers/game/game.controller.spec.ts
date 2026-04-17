import { AdminGateway } from '@app/gateways/admin/admin.gateway';
import { GameCatalogGateway } from '@app/gateways/game-catalog/game-catalog.gateway';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { Game } from '@app/model/schema/game.schema';
import { GameService } from '@app/services/game/game.service';
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { createStubInstance, SinonStubbedInstance } from 'sinon';
import { GameController } from './game.controller';

describe('GameController', () => {
    let controller: GameController;
    let gameService: SinonStubbedInstance<GameService>;
    let adminGateway: SinonStubbedInstance<AdminGateway>;
    let gameCatalogGateway: SinonStubbedInstance<GameCatalogGateway>;

    beforeEach(async () => {
        gameService = createStubInstance(GameService);
        adminGateway = createStubInstance(AdminGateway);
        gameCatalogGateway = createStubInstance(GameCatalogGateway);
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GameController],
            providers: [
                {
                    provide: GameService,
                    useValue: gameService,
                },
                {
                    provide: AdminGateway,
                    useValue: adminGateway,
                },
                {
                    provide: GameCatalogGateway,
                    useValue: gameCatalogGateway,
                },
            ],
        }).compile();

        controller = module.get<GameController>(GameController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('allGames() should return all games', async () => {
        const fakeGames = [new Game(), new Game()];
        gameService.getAllGames.resolves(fakeGames);

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.OK);
            return res;
        };
        res.json = (games) => {
            expect(games).toEqual(fakeGames);
            return res;
        };

        await controller.allGames(res);
    });

    it('allGames() should return NOT_FOUND when service unable to fetch games', async () => {
        gameService.getAllGames.rejects(new Error('Aucun jeu trouvé'));

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.NOT_FOUND);
            return res;
        };
        res.json = (message) => {
            expect(message).toBeDefined();
            return res;
        };

        await controller.allGames(res);
    });

    it('getGame() should return the game', async () => {
        const fakeGame = new Game();
        gameService.getGameById.resolves(fakeGame);

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.OK);
            return res;
        };
        res.json = (game) => {
            expect(game).toEqual(fakeGame);
            return res;
        };

        await controller.getGame('game-id', res);
    });

    it('getGame() should return NOT_FOUND when service unable to fetch the game', async () => {
        gameService.getGameById.rejects(new Error('Aucun jeu trouvé'));

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.NOT_FOUND);
            return res;
        };
        res.json = (message) => {
            expect(message).toBeDefined();
            return res;
        };

        await controller.getGame('game-id', res);
    });

    it('addGame() should succeed and notify both gateways when game is visible', async () => {
        const fakeGame = new Game();
        fakeGame.isVisible = true;
        gameService.addGame.resolves(fakeGame);

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.CREATED);
            return res;
        };
        res.json = (message) => {
            expect(message).toEqual('Le jeu a été créé avec succès !');
            return res;
        };

        const gameDto: CreateGameDto = {} as CreateGameDto;
        await controller.addGame(gameDto, res);
        expect(adminGateway.notifyGameCreated.calledOnce).toBe(true);
        expect(gameCatalogGateway.notifyGameCreated.calledOnce).toBe(true);
    });

    it('addGame() should succeed and notify only admin gateway when game is not visible', async () => {
        const fakeGame = new Game();
        fakeGame.isVisible = false;
        gameService.addGame.resolves(fakeGame);

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.CREATED);
            return res;
        };
        res.json = (message) => {
            expect(message).toEqual('Le jeu a été créé avec succès !');
            return res;
        };

        const gameDto: CreateGameDto = {} as CreateGameDto;
        await controller.addGame(gameDto, res);
        expect(adminGateway.notifyGameCreated.calledOnce).toBe(true);
        expect(gameCatalogGateway.notifyGameCreated.called).toBe(false);
    });

    it('addGame() should return BAD_REQUEST when service unable to add the game', async () => {
        gameService.addGame.rejects(new Error('Creation failed'));

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.BAD_REQUEST);
            return res;
        };
        res.json = (message) => {
            expect(message).toBeDefined();
            return res;
        };

        const gameDto: CreateGameDto = {} as CreateGameDto;
        await controller.addGame(gameDto, res);
    });

    it('modifyGame() should succeed and notify admin gateway when game remains visible', async () => {
        const fakeGame = new Game();
        fakeGame.isVisible = true;
        gameService.modifyGame.resolves(fakeGame);

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.OK);
            return res;
        };
        res.json = (message) => {
            expect(message).toEqual('Le jeu a été modifié avec succès !');
            return res;
        };

        const gameDto: UpdateGameDto = {} as UpdateGameDto;
        await controller.modifyGame('game-id', gameDto, res);
        expect(adminGateway.notifyGameUpdated.calledOnce).toBe(true);
        expect(gameCatalogGateway.notifyGameDeleted.called).toBe(false);
    });

    it('modifyGame() should succeed and notify game deletion when game becomes invisible', async () => {
        const fakeGame = new Game();
        fakeGame.isVisible = false;
        gameService.modifyGame.resolves(fakeGame);

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.OK);
            return res;
        };
        res.json = (message) => {
            expect(message).toEqual('Le jeu a été modifié avec succès !');
            return res;
        };

        const gameDto: UpdateGameDto = {} as UpdateGameDto;
        await controller.modifyGame('game-id', gameDto, res);
        expect(adminGateway.notifyGameUpdated.calledOnce).toBe(true);
        expect(gameCatalogGateway.notifyGameDeleted.calledOnce).toBe(true);
    });

    it('modifyGame() should return NOT_FOUND when service cannot find the game', async () => {
        gameService.modifyGame.rejects(new Error('Aucun jeu trouvé avec cet identifiant.'));

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.NOT_FOUND);
            return res;
        };
        res.json = (message) => {
            expect(message).toBeDefined();
            return res;
        };

        const gameDto: UpdateGameDto = {} as UpdateGameDto;
        await controller.modifyGame('game-id', gameDto, res);
    });

    it('modifyGame() should return BAD_REQUEST when service cannot modify the game', async () => {
        gameService.modifyGame.rejects(new Error('Modification failed'));

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.BAD_REQUEST);
            return res;
        };
        res.json = (message) => {
            expect(message).toBeDefined();
            return res;
        };

        const gameDto: UpdateGameDto = {} as UpdateGameDto;
        await controller.modifyGame('game-id', gameDto, res);
    });

    it('deleteGame() should succeed if service able to delete the game', async () => {
        gameService.deleteGame.resolves();

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.NO_CONTENT);
            return res;
        };
        res.json = (message) => {
            expect(message).toEqual('Le jeu a été supprimé avec succès !');
            return res;
        };

        await controller.deleteGame('game-id', res);
        expect(adminGateway.notifyGameDeleted.calledOnce).toBe(true);
        expect(gameCatalogGateway.notifyGameDeleted.calledOnce).toBe(true);
    });

    it('deleteGame() should return NOT_FOUND when service cannot delete the game', async () => {
        gameService.deleteGame.rejects(new Error('Aucun jeu trouvé'));

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.NOT_FOUND);
            return res;
        };
        res.json = (message) => {
            expect(message).toBeDefined();
            return res;
        };

        await controller.deleteGame('game-id', res);
    });

    it('visibleGames() should return all visible games', async () => {
        const fakeGames = [new Game(), new Game()];
        gameService.getAllVisibleGames.resolves(fakeGames);

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.OK);
            return res;
        };
        res.json = (games) => {
            expect(games).toEqual(fakeGames);
            return res;
        };

        await controller.visibleGames(res);
    });

    it('visibleGames() should return NOT_FOUND when service unable to fetch visible games', async () => {
        gameService.getAllVisibleGames.rejects(new Error('Aucun jeu trouvé'));

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.NOT_FOUND);
            return res;
        };
        res.json = (message) => {
            expect(message).toBeDefined();
            return res;
        };

        await controller.visibleGames(res);
    });

    it('modifyVisibility() should succeed and notify game creation when visibility is set to true', async () => {
        const fakeGame = new Game();
        fakeGame.isVisible = true;
        gameService.updateVisibility.resolves(fakeGame);

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.OK);
            return res;
        };
        res.json = (message) => {
            expect(message).toEqual('Le jeu a été modifié avec succès !');
            return res;
        };

        await controller.modifyVisibility('game-id', true, res);
        expect(adminGateway.notifyGameVisibilityChanged.calledOnce).toBe(true);
        expect(gameCatalogGateway.notifyGameCreated.calledOnce).toBe(true);
        expect(gameCatalogGateway.notifyGameDeleted.called).toBe(false);
    });

    it('modifyVisibility() should succeed and notify game deletion when visibility is set to false', async () => {
        const fakeGame = new Game();
        fakeGame.isVisible = false;
        gameService.updateVisibility.resolves(fakeGame);

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.OK);
            return res;
        };
        res.json = (message) => {
            expect(message).toEqual('Le jeu a été modifié avec succès !');
            return res;
        };

        await controller.modifyVisibility('game-id', false, res);
        expect(adminGateway.notifyGameVisibilityChanged.calledOnce).toBe(true);
        expect(gameCatalogGateway.notifyGameDeleted.calledOnce).toBe(true);
        expect(gameCatalogGateway.notifyGameCreated.called).toBe(false);
    });

    it('modifyVisibility() should return INTERNAL_SERVER_ERROR when service cannot update visibility', async () => {
        gameService.updateVisibility.rejects(new Error('Update failed'));

        const res = {} as unknown as Response;
        res.status = (code) => {
            expect(code).toEqual(HttpStatus.INTERNAL_SERVER_ERROR);
            return res;
        };
        res.json = (message) => {
            expect(message).toBeDefined();
            return res;
        };

        await controller.modifyVisibility('game-id', false, res);
    });
});