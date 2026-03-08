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
import { WaitingRoomComponent } from '@app/pages/waiting-room/waiting-room.component';
import { JoinGamePageComponent } from '@app/pages/join-game-page/join-game-page.component';
import { CharacterSelectionComponent } from '@app/pages/character-selection/character-selection.component';

if (environment.production) {
    enableProdMode();
}

const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: HomePageComponent },
    { path: 'admin', component: AdminPageComponent },
    { path: 'admin/create', component: CreateGamePageComponent },
    { path: 'editor/new', component: MapSetupPageComponent },
    { path: 'editor/:id', component: MapSetupPageComponent },
    { path: 'create', component: GameCreationComponent },
    { path: 'character-selection/:lobbyId', component: CharacterSelectionComponent },
    { path: 'character-selection', component: CharacterSelectionComponent },
    { path: 'waiting-room', component: WaitingRoomComponent },
    { path: 'waiting-room/:lobbyId', component: WaitingRoomComponent },
    { path: 'join', component: JoinGamePageComponent },
    { path: '**', redirectTo: '/home' },
];

enableProfiling();
bootstrapApplication(AppComponent, {
    providers: [provideZoneChangeDetection(), provideHttpClient(), provideRouter(routes, withHashLocation())],
});