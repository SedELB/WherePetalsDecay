import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SanctuaryMode } from '@common/enums';
import { TileItem } from '@common/enums';

@Component({
    selector: 'app-sanctuary-modal',
    standalone: true,
    imports: [],
    templateUrl: './sanctuary-modal.component.html',
    styleUrl: './sanctuary-modal.component.scss',
})
export class SanctuaryModalComponent {
    @Input({ required: true }) type!: TileItem;
    @Output() use = new EventEmitter<SanctuaryMode>();
    protected readonly SanctuaryMode = SanctuaryMode;
    @Output() cancel = new EventEmitter<void>();

    itemTypes = TileItem;

    getSanctuaryLabel(): string {
        return this.type === TileItem.HealingSanctuary ? 'Soin (+2 PV)' : 'Combat (+1 ATK / +1 DEF)';
    }

    onUse(mode: SanctuaryMode): void {
        this.use.emit(mode);
    }

    onCancel(): void {
        this.cancel.emit();
    }
}
