import { provideHttpClient } from '@angular/common/http';
import { enableProdMode, enableProfiling, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter, withHashLocation, withViewTransitions } from '@angular/router';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AppComponent } from '@app/pages/app/app.component';
import { CharacterSelectionComponent } from '@app/pages/character-selection/character-selection.component';
import { CreateGamePageComponent } from '@app/pages/create-game-page/create-game-page.component';
import { EndGamePageComponent } from '@app/pages/end-game-page/end-game-page.component';
import { GameCreationComponent } from '@app/pages/game-creation/game-creation.component';
import { GamePageComponent } from '@app/pages/game-page/game-page.component';
import { HomePageComponent } from '@app/pages/homepage/homepage.component';
import { JoinGamePageComponent } from '@app/pages/join-game-page/join-game-page.component';
import { MapSetupPageComponent } from '@app/pages/map-setup-page/map-setup-page.component';
import { WaitingRoomComponent } from '@app/pages/waiting-room/waiting-room.component';
import { environment } from './environments/environment';

if (environment.production) {
    enableProdMode();
}

const title = 'Where Petals Decay';

const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: HomePageComponent, title },
    { path: 'admin', component: AdminPageComponent, title: title + ' - Admin'},
    { path: 'admin/create', component: CreateGamePageComponent, title: title + ' - Create a Map'},
    { path: 'editor/new', component: MapSetupPageComponent, title: title + ' - New Map' },
    { path: 'editor/:id', component: MapSetupPageComponent, title: title + ' - Edit Map' },
    { path: 'create', component: GameCreationComponent, title: title + ' - Host a Game' },
    { path: 'character-selection/:lobbyId', component: CharacterSelectionComponent },
    { path: 'character-selection', component: CharacterSelectionComponent, title: 'WPD - Select your character' },
    { path: 'game/:id', component: GamePageComponent, title: title + ' - In-game' },
    { path: 'waiting-room/:lobbyId', component: WaitingRoomComponent, title: title + ' - Waiting Room'},
    { path: 'join', component: JoinGamePageComponent, title: title + ' - Join a Game' },
    { path: 'end-game', component: EndGamePageComponent, title: title + ' - Game Statistics' },
    { path: '**', redirectTo: '/home' },
];

enableProfiling();
bootstrapApplication(AppComponent, {
    providers: [provideZoneChangeDetection(), provideHttpClient(), provideRouter(routes, withHashLocation(), withViewTransitions())],
});
