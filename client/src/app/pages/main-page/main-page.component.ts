import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-main-page',
    templateUrl: './main-page.component.html',
    styleUrls: ['./main-page.component.scss'],
    imports: [RouterLink],
})
export class MainPageComponent {
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