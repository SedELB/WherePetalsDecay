import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonComponentComponent } from '@app/components/button-component/button-component.component';

@Component({
  selector: 'app-map-setup-page',
  imports: [FormsModule, RouterLink, ButtonComponentComponent],
  templateUrl: './map-setup-page.component.html',
  styleUrl: './map-setup-page.component.scss',
})
export class MapSetupPageComponent {
  private readonly router = inject(Router);

  gameName = '';
  gameDescription = '';

  onBack(): void {
    this.router.navigate(['/admin']);
  }

  onSave(): void {
    console.log('Sauvegarder (placeholder)');
  }
}
