import { Component } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';
import { SakuraComponent } from '@app/components/sakura/sakura.component';
import { ButtonVariant } from '@common/enums';

@Component({
    selector: 'app-main-page',
    standalone: true,
    templateUrl: './homepage.component.html',
    styleUrls: ['./homepage.component.scss'],
    imports: [ButtonComponent, SakuraComponent],
})
export class HomePageComponent {
    protected readonly buttonVariant = ButtonVariant;
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