// HUD: resources, build menu, selected-building production panel,
// research modal, game-over overlay.

import { BUILDINGS, BUILD_MENU, TRAIN, UPGRADES, type BuildingKind } from '../data/buildings';
import { UNITS, type UnitKind } from '../data/units';
import type { Building, PlayerState } from '../game/world';

export interface HudCallbacks {
  onPickBuilding(kind: BuildingKind): void;
  onTrain(kind: UnitKind): void;
  onPickUpgrade(id: string): void;
  onRestart(): void;
}

const UNIT_ICONS: Record<UnitKind, string> = {
  knight: '⚔️',
  spear: '🔱',
  archer: '🏹',
  cavalry: '🐴',
  mage: '🔮',
  catapult: '🛠️',
};

export class Hud {
  private selectionEl = document.getElementById('selection-info')!;
  private fpsEl = document.getElementById('fps')!;
  private hintEl = document.getElementById('hint-bar')!;
  private defaultHint = this.hintEl.innerHTML;
  private goldEl = document.getElementById('gold')!;
  private incomeEl = document.getElementById('income')!;
  private supplyEl = document.getElementById('supply')!;
  private buildMenuEl = document.getElementById('build-menu')!;
  private bPanel = document.getElementById('building-panel')!;
  private bpTitle = document.getElementById('bp-title')!;
  private bpTrains = document.getElementById('bp-trains')!;
  private bpQueue = document.getElementById('bp-queue')!;
  private bpHint = document.getElementById('bp-hint')!;
  private researchFab = document.getElementById('research-fab')!;
  private researchBadge = document.getElementById('research-badge')!;
  private researchModal = document.getElementById('research-modal')!;
  private researchChoices = document.getElementById('research-choices')!;
  private gameoverEl = document.getElementById('gameover')!;
  private goTitle = document.getElementById('go-title')!;

  private buildCards = new Map<BuildingKind, HTMLButtonElement>();
  private panelSig = '';
  private offerSig = '';
  private modalDismissed = false;

  constructor(private cb: HudCallbacks) {
    this.buildBuildMenu();
    this.researchFab.addEventListener('click', () => {
      this.modalDismissed = false;
      this.researchModal.classList.remove('hidden');
    });
    document.getElementById('research-close')!.addEventListener('click', () => {
      this.modalDismissed = true;
      this.researchModal.classList.add('hidden');
    });
    document.getElementById('go-restart')!.addEventListener('click', () => this.cb.onRestart());
  }

  // --- Build menu ---

  private buildBuildMenu(): void {
    this.buildMenuEl.innerHTML = '';
    for (const kind of BUILD_MENU) {
      const def = BUILDINGS[kind];
      const card = document.createElement('button');
      card.className = 'bcard';
      card.innerHTML =
        `<span class="hot">${def.hotkey ?? ''}</span>` +
        `<span class="ic">${def.icon}</span>` +
        `<span class="nm">${def.label}</span>` +
        `<span class="cost">🪙${def.cost}</span>`;
      card.title = this.buildTooltip(kind);
      card.addEventListener('click', () => this.cb.onPickBuilding(kind));
      this.buildMenuEl.appendChild(card);
      this.buildCards.set(kind, card);
    }
  }

  private buildTooltip(kind: BuildingKind): string {
    const def = BUILDINGS[kind];
    const bits: string[] = [def.label];
    if (def.trains) bits.push(`Üretir: ${def.trains.map((t) => UNITS[t].label).join(', ')}`);
    if (def.income) bits.push(`+${def.income} altın/sn`);
    if (def.supply) bits.push(`+${def.supply} nüfus`);
    if (def.onGold) bits.push('Altın madenine kurulur');
    if (kind === 'tower') bits.push('Yakındaki düşmanlara ok atar');
    if (kind === 'research') bits.push('Geliştirme puanı üretir');
    return bits.join(' · ');
  }

  setBuildSelection(kind: BuildingKind | null): void {
    for (const [k, el] of this.buildCards) el.classList.toggle('active', k === kind);
  }

  // --- Per-frame update ---

  update(player: PlayerState, selectedBuilding: Building | null): void {
    this.goldEl.textContent = String(Math.floor(player.gold));
    this.supplyEl.textContent = `${player.supplyUsed}/${player.supplyCap}`;
    (this.supplyEl as HTMLElement).style.color =
      player.supplyUsed >= player.supplyCap ? '#ff8a8a' : '';

    for (const [k, el] of this.buildCards) {
      el.classList.toggle('disabled', player.gold < BUILDINGS[k].cost);
    }

    this.updateBuildingPanel(player, selectedBuilding);
    this.updateResearch(player);
  }

  setIncome(perSec: number): void {
    this.incomeEl.textContent = `+${perSec.toFixed(1)}/sn`;
  }

  // --- Building panel ---

  private updateBuildingPanel(player: PlayerState, b: Building | null): void {
    if (!b) {
      this.bPanel.classList.add('hidden');
      this.panelSig = '';
      return;
    }
    this.bPanel.classList.remove('hidden');
    const def = BUILDINGS[b.kind];

    const sig = `${b.id}:${b.buildProgress >= 1 ? 1 : 0}:${b.queue.join(',')}`;
    if (sig !== this.panelSig) {
      this.panelSig = sig;
      this.bpTitle.textContent = `${def.icon} ${def.label}`;
      this.bpTrains.innerHTML = '';

      if (b.buildProgress < 1) {
        this.bpHint.textContent = 'İnşa ediliyor...';
      } else if (def.trains) {
        for (const kind of def.trains) {
          const t = TRAIN[kind];
          const card = document.createElement('button');
          card.className = 'tcard';
          card.innerHTML =
            `<span class="ic">${UNIT_ICONS[kind]}</span>` +
            `<span class="nm">${UNITS[kind].label}</span>` +
            `<span class="cost">🪙${t.cost} 👥${t.supply}</span>`;
          card.title = `${UNITS[kind].label} — ${t.time}sn`;
          card.addEventListener('click', () => this.cb.onTrain(kind));
          this.bpTrains.appendChild(card);
        }
        this.bpHint.textContent = 'Sağ tık: toplanma noktası belirle';
      } else {
        this.bpHint.textContent =
          b.kind === 'research' ? 'Geliştirme puanı üretiyor...' : '';
      }

      this.bpQueue.innerHTML = '';
      b.queue.forEach((kind, i) => {
        const q = document.createElement('div');
        q.className = 'qitem';
        q.innerHTML = `${i === 0 ? '<div class="prog"></div>' : ''}<span>${UNIT_ICONS[kind]}</span>`;
        this.bpQueue.appendChild(q);
      });
    }

    // Per-frame: training progress + affordability
    if (b.queue.length > 0) {
      const prog = this.bpQueue.querySelector('.prog') as HTMLElement | null;
      if (prog) {
        const frac = Math.min(1, b.trainProgress / TRAIN[b.queue[0]].time);
        prog.style.width = `${frac * 100}%`;
      }
    }
    const trainCards = this.bpTrains.querySelectorAll<HTMLButtonElement>('.tcard');
    const trains = def.trains ?? [];
    trainCards.forEach((el, i) => {
      const t = TRAIN[trains[i]];
      const blocked =
        player.gold < t.cost ||
        player.supplyUsed + t.supply > player.supplyCap ||
        b.queue.length >= 5;
      el.classList.toggle('disabled', blocked);
    });
  }

  // --- Research ---

  private updateResearch(player: PlayerState): void {
    const pts = player.researchPoints;
    this.researchBadge.textContent = String(pts);
    this.researchFab.classList.toggle('hidden', pts <= 0);

    const sig = `${pts}:${player.offer.join(',')}`;
    if (sig !== this.offerSig) {
      this.offerSig = sig;
      this.researchChoices.innerHTML = '';
      for (const id of player.offer) {
        const def = UPGRADES.find((u) => u.id === id);
        if (!def) continue;
        const card = document.createElement('button');
        card.className = 'upcard';
        card.innerHTML =
          `<span class="ic">${def.icon}</span>` +
          `<span class="nm">${def.name}</span>` +
          `<span class="desc">${def.desc}</span>`;
        card.addEventListener('click', () => {
          this.cb.onPickUpgrade(id);
          this.researchModal.classList.add('hidden');
          this.modalDismissed = false;
        });
        this.researchChoices.appendChild(card);
      }
      // Auto-open when a fresh offer appears (unless the player dismissed it).
      if (pts > 0 && player.offer.length > 0 && !this.modalDismissed) {
        this.researchModal.classList.remove('hidden');
      }
    }
    if (pts <= 0) this.researchModal.classList.add('hidden');
  }

  // --- Misc ---

  setSelection(labels: string[]): void {
    if (labels.length === 0) {
      this.selectionEl.textContent = 'Birim seçilmedi';
      return;
    }
    const counts = new Map<string, number>();
    for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
    const parts = [...counts.entries()].map(([l, n]) => (n > 1 ? `${n}× ${l}` : l));
    this.selectionEl.textContent = `Seçili: ${parts.join(', ')}`;
  }

  setSelectionText(text: string): void {
    this.selectionEl.textContent = text;
  }

  setFps(fps: number): void {
    this.fpsEl.textContent = `${fps} fps`;
  }

  setHintOverride(text: string | null): void {
    if (text === null) {
      this.hintEl.innerHTML = this.defaultHint;
      this.hintEl.classList.remove('armed');
    } else {
      this.hintEl.textContent = text;
      this.hintEl.classList.add('armed');
    }
  }

  showGameOver(won: boolean): void {
    this.goTitle.textContent = won ? '🏆 Zafer!' : '💀 Yenilgi';
    this.goTitle.classList.toggle('lose', !won);
    this.gameoverEl.classList.remove('hidden');
  }
}
