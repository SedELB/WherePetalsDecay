import { TileItem } from '@common/enums';
import { Vec2 } from '@common/vec2';
import { drawSanctuarySprite } from './sanctuary-render.helper';

type MockedCanvasContext = {
    drawImage: jasmine.Spy;
    restore: jasmine.Spy;
    save: jasmine.Spy;
    scale: jasmine.Spy;
    translate: jasmine.Spy;
};

const FOOTPRINT: { north: Vec2; east: Vec2; south: Vec2; west: Vec2 } = {
    north: { x: 0, y: 0 },
    east: { x: 100, y: 50 },
    south: { x: 0, y: 100 },
    west: { x: -100, y: 50 },
};

function createMockContext(): CanvasRenderingContext2D {
    return {
        drawImage: jasmine.createSpy('drawImage'),
        filter: 'none',
        globalAlpha: 1,
        restore: jasmine.createSpy('restore'),
        save: jasmine.createSpy('save'),
        scale: jasmine.createSpy('scale'),
        shadowBlur: 0,
        shadowColor: 'transparent',
        translate: jasmine.createSpy('translate'),
    } as unknown as CanvasRenderingContext2D;
}

describe('drawSanctuarySprite', () => {
    let context: CanvasRenderingContext2D;
    let mockedContext: MockedCanvasContext;
    let getImageSpy: jasmine.Spy;

    beforeEach(() => {
        context = createMockContext();
        mockedContext = context as unknown as MockedCanvasContext;

        const image = {
            complete: true,
            naturalHeight: 100,
            naturalWidth: 200,
        } as HTMLImageElement;

        getImageSpy = jasmine.createSpy('getImage').and.returnValue(image);
    });

    it('should gray out sanctuary when inactive', () => {
        let drawFilter = '';
        let drawAlpha = 0;
        mockedContext.drawImage.and.callFake(() => {
            drawFilter = context.filter;
            drawAlpha = context.globalAlpha;
        });

        drawSanctuarySprite(context, TileItem.HealingSanctuary, FOOTPRINT, getImageSpy, {
            isGlowing: false,
            isInactive: true,
        });

        expect(mockedContext.drawImage).toHaveBeenCalled();
        expect(drawFilter).toBe('grayscale(1)');
        expect(drawAlpha).toBeLessThan(1);
    });

    it('should keep normal rendering when sanctuary is active', () => {
        let drawFilter = '';
        let drawAlpha = 0;
        mockedContext.drawImage.and.callFake(() => {
            drawFilter = context.filter;
            drawAlpha = context.globalAlpha;
        });

        drawSanctuarySprite(context, TileItem.CombatSanctuary, FOOTPRINT, getImageSpy, {
            isGlowing: false,
            isInactive: false,
        });

        expect(mockedContext.drawImage).toHaveBeenCalled();
        expect(drawFilter).toBe('none');
        expect(drawAlpha).toBe(1);
    });
});
