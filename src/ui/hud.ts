// HUD: resources, build menu, selected-building production panel,
// research modal, game-over overlay.

import { BUILDINGS, BUILD_MENU, RESEARCH_TIME, TRAIN, UPGRADES, type BuildingKind } from '../data/buildings';
import { type UnitKind, UNITS } from '../data/units';
import { CIVS, type CivId } from '../data/civs';
import type { Building, PlayerState, Unit } from '../game/world';
import { t, civLabel, civBonus, unitLabel, unitDesc, buildingLabel, upgradeText } from '../i18n';

export interface HudCallbacks {
  onPickBuilding(kind: BuildingKind): void;
  onTrain(kind: UnitKind): void;
  onResearch(): void;
  onPickUpgrade(id: string): void;
  onRestart(): void;
  onSetStance(stance: 'aggressive' | 'defensive' | 'standground'): void;
  onSetFormation(formation: 'square' | 'circle' | 'scattered'): void;
}

const UNIT_ICONS: Record<UnitKind, string> = {
  knight: '⚔️',
  spear: '🔱',
  archer: '🏹',
  cavalry: '🐴',
  villager: '🧑‍🌾',
  commander: '👑',
  catapult: '🛠️',
  golem: '🗿',
  wolf: '🐺',
  pirate: '🏴‍☠️',
  gladiator: '🛡️',
  janissary: '💥',
  berserker: '🪓',
  druid: '🔮',
};

export const CIV_UNIQUE_BUILDINGS: Record<CivId, { economy: BuildingKind[]; military: BuildingKind[]; defense: BuildingKind[] }> = {
  rome: { economy: ['forum'], military: ['colosseum'], defense: [] },
  ottoman: { economy: ['caravanserai'], military: ['mosque'], defense: [] },
  china: { economy: ['pagoda'], military: [], defense: ['bastion'] },
  viking: { economy: [], military: ['longhouse', 'shrine'], defense: [] },
  celt: { economy: ['stone_circle'], military: ['grove'], defense: [] },
};

export class Hud {
  private civ: CivId = 'rome';
  private selectionEl = document.getElementById('selection-info')!;
  private fpsEl = document.getElementById('fps')!;
  private hintEl = document.getElementById('hint-bar')!;
  private defaultHint = '';
  private goldEl = document.getElementById('gold')!;
  private incomeEl = document.getElementById('income')!;
  private supplyEl = document.getElementById('supply')!;
  private civBadge = document.getElementById('civ-badge')!;
  private civBadgeSet = false;
  private buildMenuContainerEl = document.getElementById('build-menu-container')!;
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

  initCiv(civ: CivId): void {
    this.civ = civ;
    this.buildBuildMenu();
  }

  constructor(private cb: HudCallbacks) {
    // Localize the static bits the HTML ships with Turkish defaults for.
    this.hintEl.innerHTML = t('hint.controls');
    this.defaultHint = this.hintEl.innerHTML;
    document.getElementById('go-restart')!.textContent = t('go.restart');
    const triggerTextEl = document.getElementById('bm-trigger-text');
    if (triggerTextEl) triggerTextEl.textContent = t('hud.buildings');
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

    // Formation buttons
    document.getElementById('form-square')!.addEventListener('click', () => this.cb.onSetFormation('square'));
    document.getElementById('form-circle')!.addEventListener('click', () => this.cb.onSetFormation('circle'));
    document.getElementById('form-scattered')!.addEventListener('click', () => this.cb.onSetFormation('scattered'));

    // Stance buttons
    document.getElementById('stance-aggressive')!.addEventListener('click', () => this.cb.onSetStance('aggressive'));
    document.getElementById('stance-defensive')!.addEventListener('click', () => this.cb.onSetStance('defensive'));
    document.getElementById('stance-standground')!.addEventListener('click', () => this.cb.onSetStance('standground'));
  }

  // --- Build menu ---

  private buildBuildMenu(): void {
    this.buildCards.clear();
    this.buildMenuEl.innerHTML = '';
    const unique = CIV_UNIQUE_BUILDINGS[this.civ] || { economy: [], military: [], defense: [] };
    const groups: Array<{ label: string; kinds: BuildingKind[] }> = [
      { label: t('grp.economy'), kinds: ['house', 'mine', 'research', ...unique.economy] },
      { label: t('grp.military'), kinds: ['barracks', 'archery', 'stable', 'siegeworks', ...unique.military] },
      { label: t('grp.defense'), kinds: ['tower', 'wall', ...unique.defense] },
    ];
    groups.forEach((g, gi) => {
      const grp = document.createElement('div');
      grp.className = 'build-group';
      const cards = document.createElement('div');
      cards.className = 'build-group-cards';
      for (const kind of g.kinds) {
        if (!BUILD_MENU.includes(kind)) continue;
        const def = BUILDINGS[kind];
        const card = document.createElement('button');
        card.className = 'bcard';
        card.innerHTML =
          `<span class="hot">${def.hotkey ?? ''}</span>` +
          `<span class="ic">${def.icon}</span>` +
          `<span class="nm">${buildingLabel(kind)}</span>` +
          `<span class="cost">🪙${def.cost}</span>`;
        card.title = this.buildTooltip(kind);
        card.addEventListener('click', () => this.cb.onPickBuilding(kind));
        cards.appendChild(card);
        this.buildCards.set(kind, card);
      }
      const label = document.createElement('div');
      label.className = 'build-group-label';
      label.textContent = g.label;
      grp.appendChild(label);
      grp.appendChild(cards);
      this.buildMenuEl.appendChild(grp);
      if (gi < groups.length - 1) {
        const sep = document.createElement('div');
        sep.className = 'build-sep';
        this.buildMenuEl.appendChild(sep);
      }
    });
  }

  private buildTooltip(kind: BuildingKind): string {
    const def = BUILDINGS[kind];
    const bits: string[] = [buildingLabel(kind)];
    if (def.trains) bits.push(t('tip.trains', { x: def.trains.map((u) => unitLabel(u)).join(', ') }));
    if (def.income) bits.push(t('tip.income', { x: def.income }));
    if (def.supply) bits.push(t('tip.supply', { x: def.supply }));
    if (def.onGold) bits.push(t('tip.onGold'));
    if (kind === 'tower') bits.push(t('tip.tower'));
    if (kind === 'research') bits.push(t('tip.research'));
    return bits.join(' · ');
  }

  setBuildSelection(kind: BuildingKind | null): void {
    for (const [k, el] of this.buildCards) el.classList.toggle('active', k === kind);
  }

  // --- Per-frame update ---

  update(player: PlayerState, selectedBuilding: Building | null, researchPrice: number): void {
    if (!this.civBadgeSet) {
      this.civBadgeSet = true;
      const civ = CIVS[player.civ];
      const bonus = civBonus(player.civ);
      (this.civBadge.querySelector('.cb-emblem') as HTMLElement).textContent = civ.emblem;
      (this.civBadge.querySelector('.cb-name') as HTMLElement).textContent = civLabel(player.civ);
      this.civBadge.setAttribute('title', `${bonus.name}: ${bonus.desc}`);
    }
    this.goldEl.textContent = String(Math.floor(player.gold));
    this.supplyEl.textContent = `${player.supplyUsed}/${player.supplyCap}`;
    (this.supplyEl as HTMLElement).style.color =
      player.supplyUsed >= player.supplyCap ? '#ff8a8a' : '';

    for (const [k, el] of this.buildCards) {
      el.classList.toggle('disabled', player.gold < BUILDINGS[k].cost);
    }

    this.updateBuildingPanel(player, selectedBuilding, researchPrice);
    this.updateResearch(player);
  }

  setIncome(perSec: number): void {
    this.incomeEl.textContent = t('hud.income', { x: perSec.toFixed(1) });
  }

  // --- Building panel ---

  private updateBuildingPanel(player: PlayerState, b: Building | null, researchPrice: number): void {
    if (!b) {
      this.bPanel.classList.add('hidden');
      this.panelSig = '';
      return;
    }
    this.bPanel.classList.remove('hidden');
    const def = BUILDINGS[b.kind];

    const sig = `${b.id}:${b.buildProgress >= 1 ? 1 : 0}:${b.queue.join(',')}:${b.researching ? 1 : 0}:${researchPrice}`;
    if (sig !== this.panelSig) {
      this.panelSig = sig;
      this.bpTitle.textContent = `${def.icon} ${buildingLabel(b.kind)}`;
      this.bpTrains.innerHTML = '';

      if (b.buildProgress < 1) {
        this.bpHint.textContent = t('hud.constructing');
      } else if (def.trains) {
        for (const kind of def.trains) {
          const tr = TRAIN[kind];
          const card = document.createElement('button');
          card.className = 'tcard';
          card.dataset.train = kind;
          card.innerHTML =
            `<span class="ic">${UNIT_ICONS[kind]}</span>` +
            `<span class="nm">${unitLabel(kind)}</span>` +
            `<span class="cost">🪙${tr.cost} 👥${tr.supply}</span>`;
          card.title = t('tip.trainTime', { x: unitLabel(kind), t: tr.time });
          card.addEventListener('click', () => this.cb.onTrain(kind));
          this.bpTrains.appendChild(card);
        }
        this.bpHint.textContent = t('hud.rallyHint');
      } else if (b.kind === 'research') {
        const card = document.createElement('button');
        card.className = 'tcard research-buy';
        if (b.researching) {
          card.innerHTML =
            `<span class="ic">🔬</span>` +
            `<span class="nm">${t('hud.researching')}</span>` +
            `<span class="cost"><span class="rprog">0%</span></span>`;
          card.classList.add('disabled');
        } else {
          card.innerHTML =
            `<span class="ic">🔬</span>` +
            `<span class="nm">${t('hud.research')}</span>` +
            `<span class="cost">🪙${researchPrice}</span>`;
          card.addEventListener('click', () => this.cb.onResearch());
        }
        this.bpTrains.appendChild(card);
        this.bpHint.textContent = b.researching
          ? t('hud.researchingHint')
          : t('hud.researchBuyHint');
      } else {
        this.bpHint.textContent = '';
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
        const tTime = TRAIN[b.queue[0]].time * (CIVS[player.civ].trainTimeMul ?? 1);
        const frac = Math.min(1, b.trainProgress / tTime);
        prog.style.width = `${frac * 100}%`;
      }
    }
    if (b.kind === 'research' && b.researching) {
      const rp = this.bpTrains.querySelector('.rprog');
      if (rp) rp.textContent = `${Math.floor((b.researchTimer / RESEARCH_TIME) * 100)}%`;
    }
    if (b.kind === 'research' && !b.researching) {
      const buy = this.bpTrains.querySelector('.research-buy');
      if (buy) buy.classList.toggle('disabled', player.gold < researchPrice);
    }
    // Only real training cards carry data-train; the research-buy card is excluded.
    const trainCards = this.bpTrains.querySelectorAll<HTMLButtonElement>('.tcard[data-train]');
    trainCards.forEach((el) => {
      const t = TRAIN[el.dataset.train as UnitKind];
      if (!t) return;
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
        const txt = upgradeText(id);
        const card = document.createElement('button');
        card.className = 'upcard';
        card.innerHTML =
          `<span class="ic">${def.icon}</span>` +
          `<span class="nm">${txt.name}</span>` +
          `<span class="desc">${txt.desc}</span>`;
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

  setSelection(
    units: Unit[],
    teamCivs: Record<number, CivId>,
    onSelectOnly: (unitId: number) => void,
    onSelectAllOfKind: (kind: UnitKind) => void
  ): void {
    const panel = document.getElementById('selection-panel')!;
    const selSingle = document.getElementById('sel-single')!;
    const selMulti = document.getElementById('sel-multi')!;
    const selGrid = document.getElementById('sel-grid')!;
    const selMultiSummary = document.getElementById('sel-multi-summary')!;

    if (units.length === 0) {
      panel.classList.add('hidden');
      this.selectionEl.textContent = t('hud.noSelection');
      return;
    }

    panel.classList.remove('hidden');

    if (units.length === 1) {
      selSingle.classList.remove('hidden');
      selMulti.classList.add('hidden');

      const u = units[0];
      const kind = u.kind;
      const portrait = document.getElementById('sel-portrait')!;
      portrait.textContent = UNIT_ICONS[kind] || '⚔️';

      const nameEl = document.getElementById('sel-name')!;
      const civ = teamCivs[u.team];
      nameEl.textContent = kind === 'commander' ? t(`comm.${civ}`) : unitLabel(kind);

      const hpEl = document.getElementById('sel-hp')!;
      const currentHp = u.hp > 0 && u.hp < 1 ? 1 : Math.round(u.hp);
      const maxHp = Math.round(u.maxHp);
      hpEl.textContent = `${Math.min(maxHp, currentHp)}/${maxHp}`;

      // Get stats
      const def = UNITS[kind];
      const atkEl = document.getElementById('sel-atk')!;
      const rangeEl = document.getElementById('sel-range')!;
      const speedEl = document.getElementById('sel-speed')!;

      atkEl.textContent = String(def.damage);
      rangeEl.textContent = String(def.range);
      speedEl.textContent = String(def.speed.toFixed(1));

      const descEl = document.getElementById('sel-desc')!;
      descEl.textContent = unitDesc(kind);

      this.selectionEl.textContent = t('hud.selected', { x: nameEl.textContent });
    } else {
      selSingle.classList.add('hidden');
      selMulti.classList.remove('hidden');

      selGrid.innerHTML = '';
      units.forEach((u) => {
        const item = document.createElement('div');
        item.className = 'sel-grid-item';
        item.textContent = UNIT_ICONS[u.kind] || '⚔️';
        item.title = u.kind === 'commander' ? t(`comm.${teamCivs[u.team]}`) : unitLabel(u.kind);

        // Click to select only this unit
        item.addEventListener('click', () => {
          onSelectOnly(u.id);
        });

        // Double click to select all of this kind in the current selection
        item.addEventListener('dblclick', () => {
          onSelectAllOfKind(u.kind);
        });

        selGrid.appendChild(item);
      });

      selMultiSummary.textContent = t('hud.multiSummary', { n: units.length });

      const counts = new Map<string, number>();
      for (const u of units) {
        const label = u.kind === 'commander' ? t(`comm.${teamCivs[u.team]}`) : unitLabel(u.kind);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      const parts = [...counts.entries()].map(([l, n]) => (n > 1 ? `${n}× ${l}` : l));
      this.selectionEl.textContent = t('hud.selected', { x: parts.join(', ') });
    }
  }

  setSelectionText(text: string): void {
    const panel = document.getElementById('selection-panel')!;
    panel.classList.add('hidden');
    this.selectionEl.textContent = text;
  }

  setFps(fps: number): void {
    this.fpsEl.textContent = t('hud.fps', { x: fps });
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

  showGameOver(won: boolean, titleOverride?: string): void {
    this.goTitle.textContent = titleOverride ?? (won ? t('go.victory') : t('go.defeat'));
    this.goTitle.classList.toggle('lose', !won);
    this.gameoverEl.classList.remove('hidden');
  }

  setBuildMenuEnabled(enabled: boolean): void {
    this.buildMenuContainerEl.classList.toggle('hidden', !enabled);
    this.buildCards.forEach((card) => {
      card.disabled = !enabled;
      card.classList.toggle('disabled', !enabled);
    });
  }

  setFormationStancePanelVisible(visible: boolean, hasVillager = false): void {
    const el = document.getElementById('formation-stance-panel');
    if (el) {
      el.classList.toggle('hidden', !visible);
      if (visible) {
        el.style.bottom = hasVillager ? '68px' : '12px';
      }
    }
  }

  updateStanceButtons(stance: 'aggressive' | 'defensive' | 'standground'): void {
    const agg = document.getElementById('stance-aggressive')!;
    const def = document.getElementById('stance-defensive')!;
    const stg = document.getElementById('stance-standground')!;

    agg.classList.toggle('active', stance === 'aggressive');
    def.classList.toggle('active', stance === 'defensive');
    stg.classList.toggle('active', stance === 'standground');
  }

  updateFormationButtons(formation: 'square' | 'circle' | 'scattered'): void {
    const sq = document.getElementById('form-square')!;
    const circ = document.getElementById('form-circle')!;
    const scat = document.getElementById('form-scattered')!;

    sq.classList.toggle('active', formation === 'square');
    circ.classList.toggle('active', formation === 'circle');
    scat.classList.toggle('active', formation === 'scattered');
  }
}
