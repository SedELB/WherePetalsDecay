import { Component } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';
import { ɵɵRouterLink } from "@angular/router/testing";

@Component({
    selector: 'app-main-page',
    templateUrl: './homepage.component.html',
    styleUrls: ['./homepage.component.scss'],
    imports: [ButtonComponent, ɵɵRouterLink],
})
export class HomePageComponent {
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