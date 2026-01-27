import { provideHttpClient } from '@angular/common/http';
import { enableProdMode, enableProfiling, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter, withHashLocation } from '@angular/router';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AppComponent } from '@app/pages/app/app.component';
<<<<<<< HEAD
import { CreateGamePageComponent } from '@app/pages/create-game-page/create-game-page.component';
import { GamePageComponent } from '@app/pages/game-page/game-page.component';
=======
>>>>>>> dev
import { HomePageComponent } from '@app/pages/homepage/homepage.component';
import { MapSetupPageComponent } from '@app/pages/map-setup-page/map-setup-page.component';
import { MaterialPageComponent } from '@app/pages/material-page/material-page.component';
<<<<<<< HEAD
=======
import { EditorPageComponent } from '@app/pages/editor-page/editor-page.component';
import { CreateGamePageComponent } from '@app/pages/create-game-page/create-game-page.component';
import { GameCreationComponent } from '@app/pages/game-creation/game-creation.component';
import { WaitingRoomComponent } from '@app/pages/waiting-room/waiting-room.component';
>>>>>>> dev
import { environment } from './environments/environment';

if (environment.production) {
    enableProdMode();
}

const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: HomePageComponent },
    { path: 'material', component: MaterialPageComponent },
    { path: 'admin', component: AdminPageComponent },
    { path: 'admin/create', component: CreateGamePageComponent },
<<<<<<< HEAD
    { path: 'editor', component: MapSetupPageComponent },
=======
    { path: 'editor', component: EditorPageComponent },
    { path: 'create', component: GameCreationComponent },
    { path: 'waiting-room', component: WaitingRoomComponent },
>>>>>>> dev
    { path: '**', redirectTo: '/home' },
];

enableProfiling();
bootstrapApplication(AppComponent, {
    providers: [provideZoneChangeDetection(), provideHttpClient(), provideRouter(routes, withHashLocation())],
});