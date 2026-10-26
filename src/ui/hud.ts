// DOM interface: resource bar, era card, build menu, info panel, research and warehouse panels, toasts, menu.
import { Game, Bld, QUESTS } from '../sim/game';
import {
  BUILDINGS, BUILD_MENU, BuildingId, GOOD_IDS, GoodId, GOODS, TIERS, TIER_IDS, WEATHER, SEASONS, ERAS, Era,
  TECHS, TECH_IDS, TechId, BRANCHES, Cost, menuItems, SERVICES,
} from '../sim/data';
import type { AudioSettings } from '../audio/sound';
import type { RotateMode } from '../render/camera';
import { icon } from './icons';
import { SEASON_IDS, SEASON_DAYS, DAY_LENGTH, HEAT_BELOW, PER_DAY, FOODS, FoodId, PROTECTS, ProtectId } from '../sim/data';
import { supplies, needs as chainNeeds, chainSummary, outPerDay } from './chain';

export type Tool = 'select' | 'demolish' | BuildingId;

export interface HudHooks {
  tool(t: Tool): void;
  speed(s: number): void;
  save(): void;
  newGame(): void;
  upgrade(b: Bld): void;
  upgradeAll(b: Bld): void;
  demolish(b: Bld): void;
  close(): void;
  focus(b: Bld): void;
  audio(p: Partial<AudioSettings>): void;
  rotateMode(m: RotateMode): void;
  click(): void;
  research(t: TechId): void;
  trade(g: GoodId, n: number): void;
  overlay(on: boolean): void;
  pause(b: Bld): void;
  seasonDays(n: number): void;
  rotate(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const fmt = (n: number) => Math.floor(n).toLocaleString('zh-CN');
const ERA_NUM = ['', '一', '二', '三', '四'];
export const HOUSE_NAMES: Record<string, string> = { peasant: '农舍', worker: '工人住宅', technician: '技工公寓', citizen: '市民楼' };

const refund = (c: Cost): Cost => { const o: Cost = { gold: Math.floor(c.gold / 2) }; for (const k of GOOD_IDS) if (c[k]) o[k] = Math.ceil(c[k]! / 2); return o; };
/** "50 金币 · 4 砖" as icon chips */
export function costHtml(c: Cost, g?: Game) {
  const parts = [`<span class="${g && g.gold < c.gold ? 'short' : ''}">${icon('gold')}${c.gold}</span>`];
  for (const k of GOOD_IDS) if (c[k]) parts.push(`<span class="${g && g.storage[k] < c[k]! ? 'short' : ''}" title="${GOODS[k].name}">${icon(k)}${c[k]}</span>`);
  return parts.join('');
}

export class Hud {
  private game!: Game;
  private tab = 0;
  private tool: Tool = 'select';
  private selected: Bld | null = null;
  private infoKey = '';
  private toastT = 0;
  private itemsKey = '';
  private overlayOn = false;

  constructor(private root: HTMLElement, private hooks: HudHooks, private thumbs: Record<string, string>) {
    root.innerHTML = `
      <div class="topbar">
        <div class="res" id="res"></div>
        <div class="speed" id="speed" role="group" aria-label="游戏速度">
          <button data-speed="0" title="暂停 (空格)">暂停</button>
          <button data-speed="1">1×</button>
          <button data-speed="2">2×</button>
          <button data-speed="4">4×</button>
        </div>
        <button class="menu-btn icon-btn" id="muteBtn" aria-label="静音"></button>
        <button class="menu-btn" id="menuBtn" aria-haspopup="true">菜单</button>
      </div>
      <aside class="quest card" id="quest"></aside>
      <aside class="info card" id="info" hidden></aside>
      <div class="build card" id="build">
        <div class="tabs" id="tabs" role="tablist"></div>
        <div class="items" id="items"></div>
        <div class="tools">
          <button id="tResearch" title="研究 (T)">${icon('research')}研究</button>
          <button id="tLedger" title="收支账本 (L)">${icon('ledger')}账本</button>
          <button id="tGoods" title="仓库与商船 (G)">${icon('box')}仓库</button>
          <button id="tOverlay" title="污染视图 (P)">${icon('pollution')}污染</button>
          <button id="tRotate" title="旋转建筑 (F)" hidden>↻ 旋转</button>
          <button id="tSelect" title="选择 (Esc)">选择</button>
          <button id="tDemolish" title="拆除 (X)">拆除</button>
        </div>
      </div>
      <div class="panel card" id="research" hidden role="dialog" aria-label="研究"></div>
      <div class="panel card" id="goods" hidden role="dialog" aria-label="仓库与商船"></div>
      <div class="panel card" id="ledger" hidden role="dialog" aria-label="收支账本"></div>
      <div class="toasts" id="toasts" aria-live="polite"></div>
      <div class="menu card" id="menu" hidden>
        <h3>暖港</h3>
        <button data-m="save">保存游戏</button>
        <button data-m="new">重新开始</button>
        <div class="settings">
          <label for="volMusic">音乐</label><input type="range" id="volMusic" min="0" max="1" step="0.05">
          <label for="volSfx">音效</label><input type="range" id="volSfx" min="0" max="1" step="0.05">
          <label for="seasonLen">季节长度</label>
          <select id="seasonLen"><option value="3">每季 3 天（一年 48 分钟）</option><option value="4">每季 4 天（一年 64 分钟）</option><option value="6">每季 6 天（一年 96 分钟）</option></select>
          <label for="rotMode">转动方式</label>
          <select id="rotMode"><option value="orbit">旋转地图（绕画面中心）</option><option value="look">转动视角（镜头原地转）</option></select>
        </div>
        <button data-m="help">操作说明</button>
        <div class="help" id="help" hidden>
          <p><b>移动镜头</b>：右键（或左键）拖动地面，或按 W A S D</p>
          <p><b>旋转地图</b>：按住中键（滚轮）拖动，或按住 Q / E</p>
          <p><b>缩放</b>：滚轮，手机上双指捏合</p>
          <p><b>修路</b>：选"道路"后按住拖动</p>
          <p><b>研究 / 仓库 / 污染</b>：T / G / P</p><p><b>旋转建筑</b>：放置长方形建筑时按 F</p>
          <p><b>取消</b>：右键单击或 Esc</p>
          <p>气温低于 8°C 住宅就要烧柴火（工业时代后烧煤），越冷烧得越多，秋天记得囤好燃料。</p><p><b>账本</b>：L，或点金币、货物数字，看每分钟的收入支出和货物进出。</p>
          <p>游戏每 30 秒自动保存在这台设备的浏览器里。</p>
        </div>
      </div>`;
    root.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) hooks.click(); });
    // sound
    $('#muteBtn', root).addEventListener('click', () => { this.audio.muted = !this.audio.muted; hooks.audio({ muted: this.audio.muted }); this.renderAudio(); });
    $<HTMLInputElement>('#volMusic', root).addEventListener('input', e => { this.audio.music = Number((e.target as HTMLInputElement).value); hooks.audio({ music: this.audio.music }); });
    $<HTMLInputElement>('#volSfx', root).addEventListener('input', e => { this.audio.sfx = Number((e.target as HTMLInputElement).value); hooks.audio({ sfx: this.audio.sfx }); });
    $<HTMLSelectElement>('#seasonLen', root).addEventListener('change', e => hooks.seasonDays(Number((e.target as HTMLSelectElement).value)));
    $<HTMLSelectElement>('#rotMode', root).addEventListener('change', e => hooks.rotateMode((e.target as HTMLSelectElement).value as RotateMode));
    $('#speed', root).addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) hooks.speed(Number(b.dataset.speed));
    });
    // top bar shortcuts
    // pointerdown, because the bar is redrawn a few times a second and a click could land on a stale node
    $('#res', root).addEventListener('pointerdown', e => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-open]');
      if (!el) return;
      hooks.click();
      const a = el.dataset.open;
      if (a === 'research') this.togglePanel('research');
      if (a === 'goods') this.togglePanel('goods');
      if (a === 'ledger') { this.ledgerTab = el.dataset.good ? 'goods' : 'gold'; this.ledgerOpen = (el.dataset.good as GoodId) || this.ledgerOpen; this.togglePanel('ledger', true); }
    });
    // menu
    const menu = $('#menu', root);
    $('#menuBtn', root).addEventListener('click', () => { menu.hidden = !menu.hidden; });
    menu.addEventListener('click', e => {
      const m = (e.target as HTMLElement).closest('button')?.dataset.m;
      if (m === 'save') { hooks.save(); menu.hidden = true; }
      if (m === 'new') {
        const b = (e.target as HTMLElement).closest('button')!;
        if (b.dataset.confirm) { hooks.newGame(); menu.hidden = true; delete b.dataset.confirm; b.textContent = '重新开始'; }
        else { b.dataset.confirm = '1'; b.textContent = '确定？当前进度会丢失'; }
      }
      if (m === 'help') $('#help', root).hidden = !$('#help', root).hidden;
    });
    // tabs & items
    const tabs = $('#tabs', root);
    tabs.innerHTML = BUILD_MENU.map((c, i) => `<button role="tab" data-tab="${i}">${c.name}</button>`).join('');
    tabs.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      this.tab = Number(b.dataset.tab);
      this.renderItems();
    });
    $('#items', root).addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      if (b.classList.contains('locked')) { this.game.notify(b.dataset.lock!, 'info'); return; }
      hooks.tool((this.tool === b.dataset.type ? 'select' : b.dataset.type) as Tool);
    });
    const quest = $('#quest', root);
    if (innerWidth <= 720) quest.classList.add('mini');
    quest.addEventListener('click', () => quest.classList.toggle('mini'));
    $('#tSelect', root).addEventListener('click', () => hooks.tool('select'));
    $('#tRotate', root).addEventListener('click', () => hooks.rotate());
    $('#tDemolish', root).addEventListener('click', () => hooks.tool(this.tool === 'demolish' ? 'select' : 'demolish'));
    $('#tResearch', root).addEventListener('click', () => this.togglePanel('research'));
    $('#tGoods', root).addEventListener('click', () => this.togglePanel('goods'));
    $('#tLedger', root).addEventListener('click', () => this.togglePanel('ledger'));
    $('#tOverlay', root).addEventListener('click', () => this.setOverlay(!this.overlayOn));
    // panels
    $('#research', root).addEventListener('click', e => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-a="close"]')) { this.togglePanel('research', false); return; }
      const t = el.closest<HTMLElement>('[data-tech]')?.dataset.tech as TechId | undefined;
      if (t) { hooks.research(t); this.renderResearch(); }
    });
    $('#ledger', root).addEventListener('click', e => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-a="close"]')) { this.togglePanel('ledger', false); return; }
      if (el.closest('[data-a="trade"]')) { this.togglePanel('goods', true); return; }
      const tab = el.closest<HTMLElement>('[data-ltab]')?.dataset.ltab;
      if (tab) { this.ledgerTab = tab as 'gold' | 'goods'; this.renderLedger(); return; }
      const row = el.closest<HTMLElement>('[data-lgood]')?.dataset.lgood as GoodId | undefined;
      if (row) { this.ledgerOpen = this.ledgerOpen === row ? null : row; this.renderLedger(); }
    });
    $('#goods', root).addEventListener('click', e => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-a="close"]')) { this.togglePanel('goods', false); return; }
      const b = el.closest<HTMLElement>('[data-trade]');
      if (b) { hooks.trade(b.dataset.trade as GoodId, Number(b.dataset.n)); this.renderGoods(); }
    });
    // info actions
    $('#info', root).addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      const b = this.selected;
      if (a === 'close') hooks.close();
      if (!b) return;
      if (a === 'upgrade') hooks.upgrade(b);
      if (a === 'upgradeAll') hooks.upgradeAll(b);
      if (a === 'demolish') {
        const btn = (e.target as HTMLElement).closest('button')!;
        if (btn.dataset.confirm) hooks.demolish(b);
        else { btn.dataset.confirm = '1'; btn.textContent = '再点一次确认拆除'; }
      }
      if (a === 'focus') hooks.focus(b);
      if (a === 'pause') { hooks.pause(b); this.infoKey = ''; this.renderInfo(); }
    });
  }

  private audio: AudioSettings = { music: 0.6, sfx: 0.7, muted: false };
  setAudio(a: AudioSettings, mode: RotateMode) {
    this.audio = { ...a };
    $<HTMLInputElement>('#volMusic', this.root).value = String(a.music);
    $<HTMLInputElement>('#volSfx', this.root).value = String(a.sfx);
    $<HTMLSelectElement>('#rotMode', this.root).value = mode;
    this.renderAudio();
  }
  private renderAudio() {
    const b = $('#muteBtn', this.root);
    b.innerHTML = icon(this.audio.muted ? 'mute' : 'sound');
    b.setAttribute('aria-label', this.audio.muted ? '打开声音' : '静音');
    b.title = this.audio.muted ? '打开声音' : '静音';
  }

  setGame(g: Game) { $<HTMLSelectElement>('#seasonLen', this.root).value = String(g.seasonDays); this.game = g; this.selected = null; this.infoKey = ''; this.itemsKey = ''; this.renderInfo(); this.renderItems(); }
  setTool(t: Tool) {
    this.tool = t;
    const cat = BUILD_MENU.findIndex(c => menuItems(c.cat).includes(t as BuildingId));
    if (cat >= 0 && cat !== this.tab) this.tab = cat;
    this.itemsKey = '';
    this.renderItems();
    $('#tDemolish', this.root).classList.toggle('on', t === 'demolish');
    $('#tSelect', this.root).classList.toggle('on', t === 'select');
    $('#tRotate', this.root).hidden = !(t in BUILDINGS && BUILDINGS[t as BuildingId].size[0] !== BUILDINGS[t as BuildingId].size[1]);
  }
  select(b: Bld | null) { this.selected = b; this.infoKey = ''; this.renderInfo(); }
  setOverlay(on: boolean) {
    this.overlayOn = on;
    $('#tOverlay', this.root).classList.toggle('on', on);
    this.hooks.overlay(on);
  }
  get overlay() { return this.overlayOn; }
  /** open/close a centred panel; only one at a time */
  togglePanel(id: 'research' | 'goods' | 'ledger', force?: boolean) {
    const el = $('#' + id, this.root);
    const open = force ?? el.hidden;
    for (const p of ['research', 'goods', 'ledger']) $('#' + p, this.root).hidden = true;
    el.hidden = !open;
    $('#tResearch', this.root).classList.toggle('on', id === 'research' && open);
    $('#tGoods', this.root).classList.toggle('on', id === 'goods' && open);
    $('#tLedger', this.root).classList.toggle('on', id === 'ledger' && open);
    if (open) id === 'research' ? this.renderResearch() : id === 'goods' ? this.renderGoods() : this.renderLedger();
  }
  closePanels() { this.togglePanel('research', false); }
  get panelOpen() { return ['research', 'goods', 'ledger'].some(p => !$('#' + p, this.root).hidden); }

  private renderItems() {
    const g = this.game;
    if (!g) return;
    const key = `${this.tab}|${this.tool}|${g.era}|${Object.keys(g.research.levels).length}`;
    if (key === this.itemsKey) return;
    this.itemsKey = key;
    $('#tabs', this.root).querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(i === this.tab)));
    // show what is unlocked plus a peek at the next era
    const items = menuItems(BUILD_MENU[this.tab].cat).filter(t => BUILDINGS[t].era <= g.era + 1)
      .sort((a, b) => Number(!g.unlocked(a)) - Number(!g.unlocked(b)) || BUILDINGS[a].era - BUILDINGS[b].era);
    $('#items', this.root).innerHTML = items.map(t => {
      const d = BUILDINGS[t];
      const lock = g.lockReason(t);
      const thumb = this.thumbs[t] ? `<img src="${this.thumbs[t]}" alt="">` : `<span class="road-ico"></span>`;
      return `<button class="item${this.tool === t ? ' on' : ''}${lock ? ' locked' : ''}" data-type="${t}" data-lock="${lock}" title="${lock ? `${lock}：` : ''}${d.desc}${d.output ? '&#10;' + chainSummary(t) : ''}&#10;维护费 ${Math.round(d.upkeep * PER_DAY)}/天">
        ${thumb}${lock ? `<span class="lk">${icon('lock')}</span>` : ''}<span class="nm">${d.name}${d.hotkey ? `<kbd>${d.hotkey}</kbd>` : ''}</span>
        <span class="cost">${lock ? `<span>${lock}</span>` : costHtml(d.cost)}</span></button>`;
    }).join('');
  }

  // ---------- per-frame updates (throttled) ----------
  update(dt: number) {
    const g = this.game;
    for (const t of g.toasts.splice(0)) this.toast(t.text, t.kind);
    this.toastT += dt;
    if (this.toastT < 0.25) return;
    this.toastT = 0;
    this.renderItems();
    this.renderTop();
    $('#speed', this.root).querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === g.speed));
    $('#items', this.root).querySelectorAll<HTMLButtonElement>('.item:not(.locked)').forEach(b => {
      b.classList.toggle('poor', !g.canAfford(BUILDINGS[b.dataset.type as BuildingId].cost));
    });
    $('#tOverlay', this.root).hidden = g.era < 3 && !this.overlayOn;
    this.renderEra();
    this.updateInfo();
    if (!$('#research', this.root).hidden) this.updateResearch();
    if (!$('#goods', this.root).hidden) this.updateGoods();
    this.ledgerT += 0.25;
    if (!$('#ledger', this.root).hidden && this.ledgerT >= 1) {
      this.ledgerT = 0;
      const box = $('#ledger', this.root), st = box.scrollTop;
      this.renderLedger(); box.scrollTop = st;
    }
    const top = (this.root.querySelector('.topbar') as HTMLElement).getBoundingClientRect().bottom + 10;
    if (innerWidth > 720) {
      $('#quest', this.root).style.top = `${top}px`;
      $('#info', this.root).style.top = `${top}px`;
    } else $('#quest', this.root).style.top = `${top}px`;
  }

  /** the goods that matter right now: what people eat, burn and build with */
  private keyGoods(): GoodId[] {
    const g = this.game, set = new Set<GoodId>();
    for (const t of TIER_IDS) {
      if (!g.pop[t] && TIERS[t].era > g.era) continue;
      if (!g.pop[t] && t !== 'peasant') continue;
      for (const k of TIERS[t].foods) if (GOODS[k].era <= g.era) set.add(k);
      for (const k of Object.keys(TIERS[t].comforts)) set.add(k as GoodId);
      if (TIERS[t].fuel !== 'power') set.add(TIERS[t].fuel as GoodId);
    }
    set.add('planks');
    if (g.era >= 2) set.add('bricks');
    if (g.era >= 3) { set.add('tools'); set.add('steel'); }
    if (g.era >= 4) set.add('cement');
    return GOOD_IDS.filter(k => set.has(k));
  }

  private renderTop() {
    const g = this.game;
    const net = g.taxRate - g.upkeepRate;
    const wx = WEATHER[g.weather.cur];
    const tiers = TIER_IDS.filter(t => g.pop[t] > 0 || TIERS[t].era <= g.era);
    const total = TIER_IDS.reduce((a, t) => a + g.pop[t], 0);
    const cur = g.research.current;
    const rPct = cur ? Math.min(100, Math.round(g.research.points / g.techCost(cur) * 100)) : 0;
    const essentials = new Set<string>();
    for (const t of TIER_IDS) if (g.pop[t]) TIERS[t].foods.forEach(k => essentials.add(k));
    const winterSoon = g.era >= 2 && (g.season === 'autumn' || g.season === 'winter');
    const fuel = g.era >= 3 ? g.storage.firewood + g.storage.coal : g.storage.firewood;
    const need = g.winterFuelEstimate();
    const happyCls = g.happyAvg >= 70 ? 'ok' : g.happyAvg >= 45 ? 'mid' : 'bad';
    const nextSeason = SEASON_IDS[(SEASON_IDS.indexOf(g.season) + 1) % 4];
    const leftMin = g.seasonLeft / 60;
    const leftTxt = leftMin >= 1 ? `${Math.ceil(leftMin)} 分钟` : `${Math.ceil(g.seasonLeft)} 秒`;
    const tempCls = g.era >= 2 && g.temp < HEAT_BELOW ? (g.temp < -3 ? 'bad' : 'mid') : g.temp > 24 ? 'hot' : '';
    const rates = g.ledger.rates();
    const foodDays = g.foodDays(), hungry = TIER_IDS.some(t => g.pop[t] && g.fedRatio[t] < 0.95);
    const foodCls = hungry || foodDays < 1 ? 'low' : foodDays < 3 ? 'mid' : 'ok';
    const foodKey = (['fish', 'veg', 'bread', 'cans'] as FoodId[]).find(f => GOODS[f].era <= g.era && g.storage[f] < 1) ?? 'fish';
    const foodTip = `食物储备：库存够全城吃 ${foodDays === Infinity ? '很久' : foodDays.toFixed(1) + ' 天'}（每天要 ${Math.round(g.foodNeed())} 份饱食，库存 ${Math.round(g.foodStock())} 份）。` + TIER_IDS.filter(t => g.pop[t]).map(t => `${TIERS[t].name}吃饱 ${Math.round(g.fedRatio[t] * 100)}%`).join('，') + '。冬天菜园停产、渔场减产，秋天要多囤。';
    $('#res', this.root).innerHTML = `
      <span class="chip gold${g.gold < 0 ? ' low' : ''}" data-open="ledger" title="金币。每天税收 ${fmt(g.taxRate * PER_DAY)}，维护费 ${fmt(g.upkeepRate * PER_DAY)}${g.gold < 0 ? `。已经亏空 ${g.debtDays} 天：大家越来越不满，会罢工` : ''}（点击看收支明细）">${icon('gold')}<b>${fmt(g.gold)}</b><i class="${net >= 0 ? 'up' : 'down'}">${net >= 0 ? '+' : ''}${Math.round(net * PER_DAY)}/天</i></span>
      <span class="chip ${foodCls}" data-open="ledger" data-good="${foodKey}" title="${foodTip}">${icon('food')}<b>${foodDays === Infinity ? '—' : foodDays >= 10 ? Math.round(foodDays) : foodDays.toFixed(1)}</b><i>天</i></span>
      <span class="chip pop" title="人口 ${total}">${tiers.map(t => `<span title="${TIERS[t].name}：${g.pop[t]} 人（空闲劳动力 ${Math.max(0, g.workforce[t].have - g.workforce[t].need)}，岗位 ${g.workforce[t].need}）" class="${g.workforce[t].need > g.workforce[t].have ? 'short' : ''}">${icon(t)}<b>${g.pop[t]}</b></span>`).join('')}</span>
      <span class="chip ${happyCls}" title="平均幸福度">${icon('happy')}<b>${Math.round(g.happyAvg)}</b></span>
      ${g.era >= 3 ? `<span class="chip ${g.power.use > g.power.gen + 0.05 ? 'low' : ''}" title="电网：发电 ${g.power.gen.toFixed(1)} / 用电 ${g.power.use.toFixed(1)}">${icon('power')}<b>${g.power.gen.toFixed(0)}</b><i>/${g.power.use.toFixed(0)}</i></span>
      <span class="chip ${g.pollutionAvg > 25 ? 'low' : ''}" title="住宅区平均污染（点"污染"查看分布）">${icon('pollution')}<b>${g.pollutionAvg.toFixed(0)}</b></span>` : ''}
      <button class="chip research" data-open="research" title="研究（T）">${icon('research')}<b>${cur ? TECHS[cur].name : '选择研究'}</b>${cur ? `<span class="mini"><i style="width:${rPct}%"></i></span>` : ''}</button>
      <span class="chip clock" title="${SEASONS[g.season].name}季 第 ${g.seasonDay}/${SEASON_DAYS} 天：${SEASONS[g.season].effect}&#10;距离${SEASONS[nextSeason].name}天还有 ${leftTxt}（游戏内约 ${(g.seasonLeft / DAY_LENGTH).toFixed(1)} 天）&#10;开局以来第 ${g.day + 1} 天">${icon(g.night > 0.5 ? 'moon' : g.season)}<b>第${g.day + 1}天</b><i>${g.year}年${SEASONS[g.season].name} ${g.seasonDay}/${SEASON_DAYS} ${String(Math.floor(g.hour)).padStart(2, '0')}:${String(Math.floor((g.hour % 1) * 60)).padStart(2, '0')}</i><span class="mini season"><i style="width:${Math.round(g.seasonFrac * 100)}%"></i></span></span>
      <span class="chip temp ${tempCls}" title="气温 ${g.temp.toFixed(1)}°C。低于 ${HEAT_BELOW}°C 住宅要烧燃料取暖，越冷烧得越多${g.era < 2 ? '（田园时代还不用取暖）' : ''}">${icon('thermo')}<b>${Math.round(g.temp)}°C</b></span>
      <span class="chip weather" title="${wx.effect}">${icon(g.weather.cur)}<b>${wx.name}</b>${wx.effect !== '一切正常' ? `<i>${wx.effect}</i>` : ''}</span>
      ${winterSoon ? `<span class="chip ${fuel < need ? 'low' : 'ok'}" title="冬季燃料：库存 ${fmt(fuel)}，整个冬天大约要烧 ${Math.ceil(need)}">${icon(g.season === 'winter' ? 'cold' : 'warm')}<b>${fmt(fuel)}</b><i>/${Math.ceil(need)}</i></span>` : ''}
      <span class="sep"></span>
      ${this.keyGoods().map(k => {
        const v = g.storage[k], low = v < 1 && essentials.has(k);
        const fl = rates[k], netK = fl ? Object.values(fl.in).reduce((a, b) => a + b, 0) - Object.values(fl.out).reduce((a, b) => a + b, 0) : 0;
        return `<span class="chip good${low ? ' low' : ''}" data-open="ledger" data-good="${k}" title="${GOODS[k].name}：${fmt(v)} / ${g.cap}，每分钟 ${netK >= 0 ? '+' : ''}${netK.toFixed(1)}（点击看明细）">${icon(k)}<b>${fmt(v)}</b>${Math.abs(netK) >= 0.3 ? `<em class="${netK > 0 ? 'up' : 'down'}">${netK > 0 ? '▲' : '▼'}</em>` : ''}</span>`;
      }).join('')}
      <button class="chip more" data-open="goods" title="全部货物与商船（G）">${icon('box')}<b>全部</b></button>`;
  }

  // ---------- era card ----------
  private renderEra() {
    const g = this.game;
    const goal = g.eraGoal();
    const q = QUESTS[g.questIndex];
    const era = ERAS[g.era];
    $('#quest', this.root).innerHTML = `
      <span class="eyebrow">第${ERA_NUM[g.era]}时代 · ${era.name}</span>
      ${goal ? `<p>迈向${ERAS[goal.era].name}</p>
        <div class="goal">${goal.parts.map(p => `<div class="need"><span>${p.label}</span><span class="bar"><i class="${p.have >= p.need ? 'ok' : 'mid'}" style="width:${Math.min(100, p.have / p.need * 100)}%"></i></span><b>${p.need > 1 ? `${Math.min(p.have, p.need)}/${p.need}` : p.have >= p.need ? '✓' : ''}</b></div>`).join('')}</div>`
        : `<p>现代城市</p><span class="sub">可以一直建设下去：治理污染、继续研究、让每个人都住得开心。</span>`}
      ${q ? `<div class="task" title="点击卡片可以收起"><span class="eyebrow soft">目标</span><span>${q.text}</span><span class="reward">${costHtml(q.reward)}</span></div>` : ''}`;
  }

  private toast(text: string, kind: string) {
    const box = $('#toasts', this.root);
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 4) box.firstElementChild!.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'good' ? 4600 : kind === 'warn' ? 3800 : 2800);
  }

  // ---------- research panel ----------
  private researchKey = '';
  private renderResearch() {
    const g = this.game;
    this.researchKey = `${g.era}|${g.research.current}|${JSON.stringify(g.research.levels)}`;
    const box = $('#research', this.root);
    const cols = ([1, 2, 3, 4] as Era[]).map(e => {
      const techs = TECH_IDS.filter(t => TECHS[t].era === e);
      return `<section class="col${e > g.era ? ' future' : ''}"><h4>第${ERA_NUM[e]}时代 · ${ERAS[e].short}</h4>${techs.map(t => {
        const d = TECHS[t], lv = g.techLevel(t), done = lv > 0 && !d.infinite, curr = g.research.current === t;
        const cls = done ? 'done' : curr ? 'cur' : g.canResearch(t) ? 'avail' : 'locked';
        return `<button class="tech ${cls} b-${d.branch}" data-tech="${t}" ${cls === 'locked' || done ? 'disabled' : ''}>
          <span class="tn">${done ? icon('check') : ''}${d.name}${d.infinite && lv ? ` <small>${lv} 级</small>` : ''}<em>${BRANCHES[d.branch]}</em></span>
          <span class="td">${d.desc}</span>
          <span class="tc">${done ? '已完成' : curr ? `<span class="bar"><i data-rp style="width:0%"></i></span>` : `${icon('research')}${g.techCost(t)}${g.research.saved[t] ? `<small>（已学 ${Math.floor(g.research.saved[t]! / g.techCost(t) * 100)}%）</small>` : ''}`}</span>
        </button>`;
      }).join('')}</section>`;
    }).join('');
    box.innerHTML = `<header><h3>研究</h3><span class="sub" data-f="rate"></span><button class="x" data-a="close" aria-label="关闭">×</button></header>
      <div class="cols">${cols}</div>`;
    this.updateResearch();
  }
  private updateResearch() {
    const g = this.game;
    const key = `${g.era}|${g.research.current}|${JSON.stringify(g.research.levels)}`;
    if (key !== this.researchKey) { this.renderResearch(); return; }
    const box = $('#research', this.root);
    const cur = g.research.current;
    const r = box.querySelector<HTMLElement>('[data-f="rate"]')!;
    r.textContent = g.research.rate > 0
      ? `研究速度 ${g.research.rate.toFixed(0)} 点/分${cur ? `　·　「${TECHS[cur].name}」还要约 ${Math.ceil((g.techCost(cur) - g.research.points) / g.research.rate)} 分钟` : '　·　点一项开始研究'}`
      : '还没有研究建筑：先建一座村塾（之后有工匠行会、大学、研究所）';
    const bar = box.querySelector<HTMLElement>('[data-rp]');
    if (bar && cur) bar.style.width = `${Math.min(100, g.research.points / g.techCost(cur) * 100)}%`;
  }

  // ---------- ledger: where gold and goods come from and go ----------
  private ledgerTab: 'gold' | 'goods' = 'gold';
  private ledgerOpen: GoodId | null = null;
  private ledgerT = 0;
  private renderLedger() {
    const g = this.game, box = $('#ledger', this.root);
    const r0 = g.ledger.rates();
    // per-minute rates shown per day
    const r: typeof r0 = {};
    for (const [k, v] of Object.entries(r0)) r[k] = { in: Object.fromEntries(Object.entries(v.in).map(([a, b]) => [a, b * PER_DAY])), out: Object.fromEntries(Object.entries(v.out).map(([a, b]) => [a, b * PER_DAY])) };
    const sum = (o: Record<string, number> = {}) => Object.values(o).reduce((a, b) => a + b, 0);
    const lines = (o: Record<string, number> = {}, sign: string) => Object.entries(o).filter(([, v]) => v >= 0.05).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<div class="lrow"><span>${k}</span><b class="${sign === '+' ? 'up' : 'down'}">${sign}${v >= 10 ? Math.round(v) : v.toFixed(1)}</b></div>`).join('') || '<div class="lrow none"><span>暂无</span></div>';
    let body = '';
    if (this.ledgerTab === 'gold') {
      const gi = r.gold?.in, go = r.gold?.out;
      // upkeep: group "维护·X" lines and show building counts
      const counts: Record<string, number> = {};
      g.buildings.forEach(b => { const n = BUILDINGS[b.type].name; counts[n] = (counts[n] ?? 0) + 1; });
      const outs: Record<string, number> = {};
      for (const [k, v] of Object.entries(go ?? {})) {
        const n = k.startsWith('维护·') ? k.slice(3) : null;
        outs[n ? `${n} ×${counts[n] ?? 0}（维护）` : k] = v;
      }
      const net = sum(gi) - sum(go);
      const hist = g.days.slice(-8).reverse();
      body = `<div class="lsum"><span>第 ${g.day + 1} 天 · 按此刻的速度</span><b class="${net >= 0 ? 'up' : 'down'}">${net >= 0 ? '+' : ''}${Math.round(net)} 金币/天</b><span class="soft">收入 ${Math.round(sum(gi))} · 支出 ${Math.round(sum(go))}</span></div>
        <div class="lcols"><section><h4>收入（每天）</h4>${lines(gi, '+')}</section><section><h4>支出（每天）</h4>${lines(outs, '-')}</section></div>
        ${hist.length ? `<h4 class="lh">最近几天</h4><div class="lhist">${hist.map(h => `<div class="lrow"><span>第 ${h.day} 天</span><b class="${h.gold >= 0 ? 'up' : 'down'}">${h.gold >= 0 ? '+' : ''}${h.gold} 金币</b><span class="soft">人口 ${h.pop} · 食物够 ${h.food === Infinity ? '—' : h.food.toFixed(1)} 天</span></div>`).join('')}</div>` : ''}
        <p class="desc">一天 = ${DAY_LENGTH / 60} 分钟（1 倍速）。税收按住户的幸福度收取，幸福度 80 以上多收 20%；生病、挨饿和房子着火的住户不交税。金库亏空时工人领不到工钱：幸福度下降，过一天开始罢工。</p>`;
    } else {
      const goods = GOOD_IDS.filter(k => GOODS[k].era <= g.era || g.storage[k] > 0);
      body = `<div class="lgoods">
        <div class="lhead"><span></span><span>货物</span><span>库存</span><span>产出/天</span><span>消耗/天</span><span>净值/天</span></div>
        ${goods.map(k => {
          const f = r[k], pin = sum(f?.in), pout = sum(f?.out), net = pin - pout;
          const eta = net < -0.05 && g.storage[k] > 0 ? `照这样约 ${(g.storage[k] / -net).toFixed(1)} 天用完` : net > 0.05 && g.storage[k] < g.cap ? `照这样约 ${((g.cap - g.storage[k]) / net).toFixed(1)} 天存满` : '';
          const open = this.ledgerOpen === k;
          return `<button class="lgood${open ? ' open' : ''}" data-lgood="${k}">${icon(k)}<span class="gn">${GOODS[k].name}</span><span>${fmt(g.storage[k])}<small>/${g.cap}</small></span><span class="up">+${pin.toFixed(1)}</span><span class="down">-${pout.toFixed(1)}</span><b class="${net >= 0.05 ? 'up' : net <= -0.05 ? 'down' : ''}">${net >= 0 ? '+' : ''}${net.toFixed(1)}</b></button>
            ${open ? `<div class="ldetail"><div class="lcols"><section><h4>来源</h4>${lines(f?.in, '+')}</section><section><h4>去向</h4>${lines(f?.out, '-')}</section></div>${eta ? `<p class="desc">${eta}</p>` : ''}</div>` : ''}`;
        }).join('')}</div>
        <p class="desc">按最近一分钟的实际进出折算成每天。点一行看来源和去向。<button class="link" data-a="trade">去商船买卖 →</button></p>`;
    }
    box.innerHTML = `<header><h3>账本</h3><div class="ltabs"><button data-ltab="gold" class="${this.ledgerTab === 'gold' ? 'on' : ''}">${icon('gold')}金币</button><button data-ltab="goods" class="${this.ledgerTab === 'goods' ? 'on' : ''}">${icon('box')}货物</button></div><button class="x" data-a="close" aria-label="关闭">×</button></header>${body}`;
    if (this.ledgerOpen && this.ledgerTab === 'goods') box.querySelector('.lgood.open')?.scrollIntoView({ block: 'nearest' });
  }

  // ---------- goods & trade panel ----------
  private goodsKey = '';
  private renderGoods() {
    const g = this.game;
    this.goodsKey = String(g.era);
    const goods = GOOD_IDS.filter(k => GOODS[k].era <= g.era);
    $('#goods', this.root).innerHTML = `<header><h3>仓库与商船</h3><span class="sub" data-f="cap"></span><button class="x" data-a="close" aria-label="关闭">×</button></header>
      <p class="desc">港口的商船随时收购多余的货物，也能高价卖给你急需的东西。</p>
      <div class="goods-grid">${goods.map(k => `<div class="gd">
        ${icon(k)}<span class="gn">${GOODS[k].name}</span><b data-g="${k}"></b>
        <button data-trade="${k}" data-n="-10" title="卖出 10 个，每个 ${GOODS[k].price} 金币">卖 10 <small>+${GOODS[k].price * 10}</small></button>
        <button data-trade="${k}" data-n="10" title="买入 10 个，每个 ${g.buyPrice(k)} 金币">买 10 <small>-${g.buyPrice(k) * 10}</small></button>
      </div>`).join('')}</div>`;
    this.updateGoods();
  }
  private updateGoods() {
    const g = this.game;
    if (this.goodsKey !== String(g.era)) { this.renderGoods(); return; }
    const box = $('#goods', this.root);
    box.querySelector<HTMLElement>('[data-f="cap"]')!.textContent = `每种货物最多存 ${g.cap}（多建仓库可以扩容）`;
    box.querySelectorAll<HTMLElement>('[data-g]').forEach(el => { const k = el.dataset.g as GoodId; el.textContent = fmt(g.storage[k]); el.classList.toggle('full', g.storage[k] >= g.cap - 0.5); });
  }

  // ---------- info panel ----------
  private renderInfo() {
    const box = $('#info', this.root);
    const b = this.selected;
    if (!b || !this.game) { box.hidden = true; return; }
    const g = this.game;
    box.hidden = false;
    const d = BUILDINGS[b.type];
    const isHouse = b.type === 'house';
    const title = isHouse ? HOUSE_NAMES[b.tier] : d.name;
    let body = '';
    if (isHouse) {
      const T = TIERS[b.tier], up = T.upgrade;
      body = `
        <div class="row"><span>居民</span><b data-f="res"></b></div>
        <div class="row"><span>税收</span><b data-f="tax"></b></div>
        <h4>幸福度 <b data-f="happy"></b></h4><div data-f="parts" class="needs parts"></div>
        <h4>需求</h4><div data-f="needs" class="needs"></div>
        <div class="row"><span>取暖</span><b data-f="fuel"></b></div>
        <div class="row"><span>吃饱</span><b data-f="fed"></b></div>
        ${up ? `<button class="primary" data-a="upgrade">升级为${TIERS[up.to].name} <small>${costHtml(up.cost)}</small></button>
        <p class="hint" data-f="block"></p><button class="ghost" data-a="upgradeAll">升级所有满足条件的${HOUSE_NAMES[b.tier]}</button>` : ''}`;
    } else if (d.cycle || d.powerGen) {
      const ins = Object.entries(d.input ?? {}) as [GoodId, number][];
      const flow = d.output || ins.length
        ? `<div class="flow">${ins.map(([k, n]) => `${icon(k)}<span>${n > 1 ? `${n}×` : ''}${GOODS[k].name}</span>`).join('<em>+</em>')}${ins.length ? '<em>→</em>' : ''}${d.output ? `${icon(d.output)}<span>${(d.outQty ?? 1) > 1 ? `${d.outQty}×` : ''}${GOODS[d.output].name}</span>` : `${icon('power')}<span>电力</span>`}</div>` : '';
      body = `${flow}
        ${d.cycle ? '<div class="bar"><i data-f="prog"></i></div>' : ''}
        ${d.workers ? `<div class="row"><span>${TIERS[d.workers.tier].name}</span><b data-f="staff"></b></div>` : ''}
        ${d.output ? `<div class="row"><span>每天产出</span><b data-f="rate"></b></div>
        <div class="chain">${chainNeeds(b.type).map(t => `<span>${icon('box')}${t}</span>`).join('')}${supplies(b.type).map(t => `<span>${icon('check')}${t}</span>`).join('')}<small>以上按满员、一天 ${DAY_LENGTH / 60} 分钟计算</small></div>` : ''}
        ${d.powerGen ? '<div class="row"><span>发电</span><b data-f="gen"></b></div>' : ''}
        ${d.power ? `<div class="row"><span>用电</span><b data-f="pow"></b></div>` : ''}
        ${d.needs === 'forest' ? '<div class="row"><span>附近树木</span><b data-f="trees"></b></div>' : ''}
        ${b.type === 'farm' || b.type === 'fishery' || b.type === 'sheepfarm' ? '<div class="row"><span>环境</span><b data-f="env"></b></div>' : ''}`;
    } else if (d.research_pts) {
      body = `<div class="row"><span>${TIERS[d.workers!.tier].name}</span><b data-f="staff"></b></div><div class="row"><span>研究</span><b data-f="rp"></b></div>
        <button class="ghost" data-a="research">打开研究面板</button>`;
    } else if (d.heating) {
      body = `<div class="row"><span>${TIERS[d.workers!.tier].name}</span><b data-f="staff"></b></div><div class="row"><span>供暖半径</span><b>${d.radius} 格</b></div><div class="row"><span>供暖住宅</span><b data-f="cov"></b></div>`;
    } else if (d.service) {
      body = `<div class="row"><span>覆盖范围</span><b>${g.usesRoads(b.type) ? `沿道路走 ${g.roadRange(b.type)} 格` : `半径 ${g.radiusOf(b)} 格`}</b></div><div class="row"><span>覆盖住宅</span><b data-f="cov"></b></div>`;
    } else if (b.type === 'depot' || b.type === 'warehouse') {
      body = `<div class="row"><span>每种货物上限</span><b data-f="cap"></b></div><button class="ghost" data-a="goods">打开仓库与商船</button>`;
    } else if (d.workers) {
      body = `<div class="row"><span>${TIERS[d.workers.tier].name}</span><b data-f="staff"></b></div>`;
    }
    if (d.pollution) body += `<div class="row"><span>${d.pollution > 0 ? '污染' : '净化'}</span><b>${d.pollution > 0 ? '' : '-'}${Math.abs(d.pollution)}</b></div>`;
    if (d.protects) body += `<div class="row"><span>${PROTECTS[d.protects]}覆盖</span><b>沿道路走 ${g.roadRange(b.type)} 格，覆盖 <span data-f="pcov"></span> 座建筑</b></div><p class="hint">和纪元一样，服务沿着道路走：门口的路连到哪，就能管到哪。</p>`;
    if (b.type !== 'depot') body += `<div class="safety" data-f="safety"></div>`;
    box.innerHTML = `
      <header><h3>${title}</h3><button class="x" data-a="close" aria-label="关闭">×</button></header>
      <span class="pill" data-f="status"></span>
      <p class="desc">${isHouse ? this.houseDesc(b) : d.desc}</p>
      ${body}
      <footer>${d.upkeep ? `<span class="upkeep">维护费 ${Math.round(d.upkeep * PER_DAY * (b.paused ? 0.25 : 1))}/天</span>` : '<span></span>'}<span class="acts">${d.workers ? `<button class="ghost small" data-a="pause">${b.paused ? '重新开工' : '暂停'}</button>` : ''}${b.type !== 'depot' ? `<button class="danger" data-a="demolish" title="返还一半造价：${costHtml(refund(d.cost)).replace(/<[^>]+>/g, ' ')}">拆除</button>` : ''}</span></footer>`;
    box.querySelector('[data-a="research"]')?.addEventListener('click', () => this.togglePanel('research', true));
    box.querySelector('[data-a="goods"]')?.addEventListener('click', () => this.togglePanel('goods', true));
    this.updateInfo();
  }
  private houseDesc(b: Bld) {
    const T = TIERS[b.tier];
    const foods = T.foods.map(k => GOODS[k].name).join('、');
    const com = Object.keys(T.comforts).map(k => GOODS[k as GoodId].name);
    const svc = T.services.map(s => SERVICES[s]);
    return `${T.name}的家。每人每天要吃 ${T.hunger} 份饱食，爱吃${foods}（种类越多越开心）${com.length ? `；还想要${com.join('、')}` : ''}；需要${svc.join('、')}的覆盖。`;
  }

  private updateInfo() {
    const b = this.selected;
    if (!b) return;
    const g = this.game;
    if (!g.buildings.has(b.id)) { this.hooks.close(); return; }
    const key = b.type + b.tier + g.era;
    if (key !== this.infoKey) { this.infoKey = key; this.renderInfo(); return; }
    const box = $('#info', this.root);
    const f = (k: string) => box.querySelector<HTMLElement>(`[data-f="${k}"]`);
    const d = BUILDINGS[b.type];
    const st = f('status');
    if (st) {
      const ok = b.type === 'house' ? b.happy >= 0.5 : b.working || (!d.workers && !d.cycle && b.connected);
      st.textContent = b.status || (b.connected ? '正常' : '没有连上道路');
      st.className = 'pill ' + (ok && b.connected ? 'ok' : 'bad');
    }
    const wn = d.workers ? g.workersFor(b.type) : 0;
    if (f('staff')) f('staff')!.textContent = `${Math.round(b.staff * wn)} / ${wn}`;
    if (b.type === 'house') {
      const T = TIERS[b.tier], hp = b.happy * 100;
      f('res')!.textContent = `${b.residents} / ${T.cap} ${T.name}${b.sick ? `（${b.sick} 人生病）` : ''}`;
      f('tax')!.textContent = `${((b.residents - b.sick) * T.tax * (hp / 100) * (hp > 80 ? 1.2 : 1) * PER_DAY).toFixed(0)} 金币/天`;
      const kinds = T.foods.filter(k => g.storage[k] >= 0.5).map(k => GOODS[k].name);
      f('fed')!.textContent = `${Math.round(b.fed * 100)}%${kinds.length ? `，有${kinds.join('、')}` : '，家里没吃的了'}`;
      f('happy')!.textContent = String(Math.round(hp));
      f('parts')!.innerHTML = b.parts.map(p => { if (p.max === 0) return `<div class="need minus"><span>${p.label}</span><b>${Math.round(p.value)}</b></div>`; const v = p.value / p.max; return `<div class="need"><span>${p.label}</span><span class="bar"><i style="width:${Math.round(v * 100)}%" class="${v > 0.95 ? 'ok' : v > 0.4 ? 'mid' : 'bad'}"></i></span></div>`; }).join('');
      f('needs')!.innerHTML = b.needs.map(n => `<div class="need"><span>${n.label}</span><span class="bar"><i style="width:${Math.round(n.value * 100)}%" class="${n.value > 0.95 ? 'ok' : n.value > 0.4 ? 'mid' : 'bad'}"></i></span></div>`).join('');
      const fuel = T.fuel === 'power' ? '电' : g.heatedBy(b) ? '煤（集中供暖）' : GOODS[T.fuel as GoodId].name;
      f('fuel')!.textContent = g.heatingOn ? `${fuel} · ${b.warm > 0.9 ? '温暖' : b.warm > 0.5 ? '有点冷' : '很冷'}` : `${fuel}（低于 ${HEAT_BELOW}°C 才烧）`;
      const up = box.querySelector<HTMLButtonElement>('[data-a="upgrade"]');
      if (up) {
        const block = g.upgradeBlock(b);
        up.disabled = !!block;
        f('block')!.textContent = block ?? '条件已满足';
      }
    } else if (d.cycle || d.powerGen) {
      if (f('prog')) f('prog')!.style.width = `${Math.round(b.progress * 100)}%`;
      if (f('rate')) {
        const mult = 1 + (g.mods.prod[b.type] ?? 0) + g.mods.prodAll;
        const now = outPerDay(b.type) * b.staff * b.env * mult * g.prodFactor(b.type);
        f('rate')!.textContent = `${now.toFixed(1)}（满员 ${outPerDay(b.type).toFixed(0)}）`;
      }
      if (f('gen')) f('gen')!.textContent = `${b.gen.toFixed(1)} / ${d.powerGen}`;
      if (f('pow')) f('pow')!.textContent = `${d.power}（电网满足 ${Math.round(g.power.ratio * 100)}%）`;
      if (f('trees')) f('trees')!.textContent = `${g.treesAround(b, d.radius!)} 棵（效率 ${Math.round(b.env * 100)}%）`;
      if (f('env')) f('env')!.textContent = b.env < 0.99 ? `污染减产 ${Math.round((1 - b.env) * 100)}%` : '良好';
    } else if (d.research_pts) {
      f('rp')!.textContent = `${(d.research_pts * b.staff * PER_DAY).toFixed(0)} 点/天`;
    } else if (d.heating || d.service) {
      let n = 0;
      g.buildings.forEach(h => { if (h.type === 'house' && (d.heating ? h.heaters.includes(b) : g.covered(h, d.service!))) n++; });
      f('cov')!.textContent = b.connected ? `${n} 座` : '没有连上道路，无法服务';
    } else if (f('cap')) f('cap')!.textContent = String(g.cap);
    if (f('pcov')) { let n = 0; g.buildings.forEach(o => { if (o !== b && o.protect.has(d.protects!)) n++; }); f('pcov')!.textContent = String(n); }
    if (f('safety')) {
      const ps = (['fire', 'health', 'police'] as ProtectId[]).filter(p => p !== 'police' || g.era >= 2).filter(p => b.type === 'house' || p === 'fire');
      f('safety')!.innerHTML = ps.map(p => `<span class="${b.protect.has(p) ? 'on' : 'off'}">${b.protect.has(p) ? '✓' : '✗'} ${PROTECTS[p]}</span>`).join('') + (b.fire > 0 ? '<span class="off">🔥 着火了</span>' : '') + (b.plague > 0 ? '<span class="off">瘟疫</span>' : '');
    }
  }
}
