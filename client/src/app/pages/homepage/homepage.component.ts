import { Component } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';
import { ASSET_PATHS } from '@common/constants/asset-paths.constants';

@Component({
    selector: 'app-main-page',
    templateUrl: './homepage.component.html',
    styleUrls: ['./homepage.component.scss'],
    imports: [ButtonComponent],
})
export class HomePageComponent {
    readonly logoPath: string = ASSET_PATHS.logo;
    readonly gameTitle: string = 'GrimStone';

    readonly teamNumber: string = '310';

    readonly teamMembers: string[] = [
        'Aymene Adaouri',
        'Aly Abdoulaye-Idriss',
        'Rayen Bouriel',
        'Saad El Bounjimi',
        'Walid Benakmoum',
        'Franck Fongang',
    ];
}