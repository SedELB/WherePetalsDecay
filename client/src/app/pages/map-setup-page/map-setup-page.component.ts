import { Component } from '@angular/core';
import { ButtonComponentComponent } from '@app/components/button-component/button-component.component';

@Component({
  selector: 'app-map-setup-page',
  imports: [ButtonComponentComponent],
  templateUrl: './map-setup-page.component.html',
  styleUrl: './map-setup-page.component.scss',
})
export class MapSetupPageComponent {




  onCreateMap() {
    console.log('Carte créée et affichée sur le canvas !');

  }
}


