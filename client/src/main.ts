import { provideHttpClient } from '@angular/common/http';
import { enableProdMode, enableProfiling, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter, withHashLocation } from '@angular/router';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { CreateGamePageComponent } from '@app/pages/create-game-page/create-game-page.component';
import { GameCreationComponent } from '@app/pages/game-creation/game-creation.component';
import { HomePageComponent } from '@app/pages/homepage/homepage.component';
import { MapSetupPageComponent } from '@app/pages/map-setup-page/map-setup-page.component';
import { environment } from './environments/environment';
import { AppComponent } from '@app/pages/app/app.component';

if (environment.production) {
    enableProdMode();
}

const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: HomePageComponent },
    { path: 'admin', component: AdminPageComponent },
    { path: 'admin/create', component: CreateGamePageComponent },
    { path: 'editor', component: MapSetupPageComponent },
    { path: 'create', component: GameCreationComponent },
    { path: '**', redirectTo: '/home' },
];

enableProfiling();
bootstrapApplication(AppComponent, {
    providers: [provideZoneChangeDetection(), provideHttpClient(), provideRouter(routes, withHashLocation())],
});