import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '@app/components/button/button.component';

@Component({
  selector: 'app-map-setup-page',
  imports: [FormsModule, ButtonComponent],
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
    // TODO
  }
}
