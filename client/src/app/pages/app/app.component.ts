import { Component, inject, OnInit, Renderer2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';

const BACKGROUND_STORAGE_KEY = 'cached-background-url';
const BACKGROUND_EXPIRY_KEY = 'cached-background-expiry';
const BACKGROUND_ASSET_PATH = '/assets/background.png';
const ONE_DAY_MS = 86400000;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [RouterOutlet],
})
export class AppComponent implements OnInit {
    private readonly renderer = inject(Renderer2);
    private readonly document = inject(DOCUMENT);

    ngOnInit(): void {
        const expiry = localStorage.getItem(BACKGROUND_EXPIRY_KEY);
        const isExpired = !expiry || Date.now() > Number(expiry);

        if (isExpired) {
            localStorage.setItem(BACKGROUND_STORAGE_KEY, BACKGROUND_ASSET_PATH);
            localStorage.setItem(BACKGROUND_EXPIRY_KEY, String(Date.now() + ONE_DAY_MS));
        }

        const backgroundUrl = localStorage.getItem(BACKGROUND_STORAGE_KEY);
        if (!backgroundUrl) return;

        this.renderer.setStyle(this.document.documentElement, '--bg-image', `url('${backgroundUrl}')`);
    }
}
