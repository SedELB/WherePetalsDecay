import { Component } from '@angular/core';
import { ButtonComponent } from '@app/components/button/button.component';

@Component({
  selector: 'app-map-setup-page',
  imports: [ButtonComponent],
  templateUrl: './map-setup-page.component.html',
  styleUrl: './map-setup-page.component.scss',
})
export class MapSetupPageComponent {

  onCreateMap() {
    // console.log('Carte créée et affichée sur le canvas !');
  }
}


