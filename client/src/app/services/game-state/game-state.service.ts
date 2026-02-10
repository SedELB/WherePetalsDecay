import { computed, Injectable, signal } from '@angular/core';
import { DEFAULT_GRID_SIZE, DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from '@app/constants/game.constants';
import { GameObject, ObjectType, PlacedObject } from '@app/interfaces/game-object.interface';
import { GameMap, MapConfig } from '@app/interfaces/map.interface';
import { Vec2 } from '@app/interfaces/vec2';

@Injectable({
    providedIn: 'root',
})
export class GameStateService {
    private readonly defaultConfig: MapConfig = {
        width: DEFAULT_MAP_WIDTH,
        height: DEFAULT_MAP_HEIGHT,
        gridSize: DEFAULT_GRID_SIZE,
    };

    private readonly objects = signal<GameObject[]>([]);
    private readonly map = signal<GameMap>({
        config: this.defaultConfig,
        placedObjects: [],
    });
    private readonly selectedTool = signal<string | null>(null);

    readonly mapConfig = computed(() => this.map().config);
    readonly placedObjects = computed(() => this.map().placedObjects);
    readonly selectedToolId = computed(() => this.selectedTool());

    constructor() {
        this.initObjects();
    }

    private initObjects(): void {
        const objs: GameObject[] = [
            {
                id: 'starting-point-1',
                type: ObjectType.StartingPoint,
                name: 'Point de départ',
                description: 'Point de départ pour les joueurs. La quantité dépend de la taille de la carte.',
                imageUrl: 'assets/starting-point.png',
                maxInstances: this.getStartingPointCount(this.defaultConfig),
                placedInstances: 0,
            },
            {
                id: 'obstacle-1',
                type: ObjectType.Obstacle,
                name: 'Obstacle',
                description: 'Obstacle qui bloque le passage des joueurs.',
                imageUrl: 'assets/obstacle.png',
                maxInstances: 5,
                placedInstances: 0,
            },
            {
                id: 'power-up-1',
                type: ObjectType.PowerUp,
                name: 'Power-up',
                description: 'Objet qui donne un avantage au joueur.',
                imageUrl: 'assets/power-up.png',
                maxInstances: 3,
                placedInstances: 0,
            },
            {
                id: 'enemy-1',
                type: ObjectType.Enemy,
                name: 'Ennemi',
                description: 'Ennemi qui attaque les joueurs.',
                imageUrl: 'assets/enemy.png',
                maxInstances: 4,
                placedInstances: 0,
            },
        ];
        this.objects.set(objs);
    }

    private getStartingPointCount(config: MapConfig): number {
        const AREA_DIVISOR = 20;
        const MIN_COUNT = 2;
        const area = config.width * config.height;
        return Math.max(MIN_COUNT, Math.floor(area / AREA_DIVISOR));
    }

    getGameObjects(): GameObject[] {
        return this.objects();
    }

    getGameObject(id: string): GameObject | undefined {
        return this.objects().find((obj) => obj.id === id);
    }

    selectTool(toolId: string | null): void {
        this.selectedTool.set(toolId);
    }

    placeObject(objectId: string, position: Vec2): boolean {
        const obj = this.getGameObject(objectId);
        if (!obj || obj.placedInstances >= obj.maxInstances) {
            return false;
        }

        const placed: PlacedObject = {
            id: `placed-${Date.now()}-${Math.random()}`,
            objectId,
            position,
            type: obj.type,
        };

        const currentMap = this.map();
        this.map.set({ ...currentMap, placedObjects: [...currentMap.placedObjects, placed] });
        this.updateObjectCount(objectId, 1);

        return true;
    }

    removeObject(placedObjectId: string): void {
        const currentMap = this.map();
        const placed = currentMap.placedObjects.find((obj) => obj.id === placedObjectId);
        if (!placed) return;

        this.map.set({
            ...currentMap,
            placedObjects: currentMap.placedObjects.filter((obj) => obj.id !== placedObjectId),
        });
        this.updateObjectCount(placed.objectId, -1);
    }

    private updateObjectCount(objectId: string, delta: number): void {
        this.objects.set(
            this.objects().map((o) =>
                o.id === objectId ? { ...o, placedInstances: Math.max(0, o.placedInstances + delta) } : o,
            ),
        );
    }

    getObjectAtPosition(position: Vec2): PlacedObject | undefined {
        return this.map().placedObjects.find((obj) => obj.position.x === position.x && obj.position.y === position.y);
    }

    isAllInstancesPlaced(objectId: string): boolean {
        const obj = this.getGameObject(objectId);
        return obj ? obj.placedInstances >= obj.maxInstances : false;
    }

    loadGame(gameMap: GameMap): void {
        this.map.set(gameMap);
        this.objects.set(
            this.objects().map((obj) => {
                const count = gameMap.placedObjects.filter((p) => p.objectId === obj.id).length;
                const updated = { ...obj, placedInstances: count };
                if (obj.type === ObjectType.StartingPoint) {
                    updated.maxInstances = this.getStartingPointCount(gameMap.config);
                }
                return updated;
            }),
        );
    }

    setMapConfig(config: MapConfig): void {
        this.map.set({ ...this.map(), config });
        this.objects.set(
            this.objects().map((obj) => {
                if (obj.type === ObjectType.StartingPoint) {
                    const newMax = this.getStartingPointCount(config);
                    return { ...obj, maxInstances: newMax, placedInstances: Math.min(obj.placedInstances, newMax) };
                }
                return obj;
            }),
        );
    }

    getCurrentGameMap(): GameMap {
        return this.map();
    }

    exportGameState(): { gameMap: GameMap; gameObjects: GameObject[] } {
        return {
            gameMap: this.map(),
            gameObjects: this.objects(),
        };
    }
}
