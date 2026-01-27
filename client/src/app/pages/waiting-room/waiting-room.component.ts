import { Component } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';

@Component({
    selector: 'app-waiting-room',
    standalone: true,
    imports: [ButtonComponent],
    templateUrl: './waiting-room.component.html',
    styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent {}