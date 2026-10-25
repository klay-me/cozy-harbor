// DOM interface: resource bar, quest card, build menu, info panel, toasts, menu.
import { Game, Bld, QUESTS } from '../sim/game';
import { BUILDINGS, BUILD_MENU, BuildingId, GOOD_IDS, GOODS, TIERS, UPGRADE_COST, WEATHER, SEASONS } from '../sim/data';
import type { AudioSettings } from '../audio/sound';
import type { RotateMode } from '../render/camera';
import { icon } from './icons';

export type Tool = 'select' | 'demolish' | BuildingId;

export interface HudHooks {
  tool(t: Tool): void;
  speed(s: number): void;
  save(): void;
  newGame(): void;
  upgrade(b: Bld): void;
  upgradeAll(): void;
  demolish(b: Bld): void;
  close(): void;
  focus(b: Bld): void;
  audio(p: Partial<AudioSettings>): void;
  rotateMode(m: RotateMode): void;
  click(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const fmt = (n: number) => Math.floor(n).toLocaleString('zh-CN');

export class Hud {
  private game!: Game;
  private tab = 0;
  private tool: Tool = 'select';
  private selected: Bld | null = null;
  private infoKey = '';
  private toastT = 0;

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
          <button id="tSelect" title="选择 (Esc)">选择</button>
          <button id="tDemolish" title="拆除 (X)">拆除</button>
        </div>
      </div>
      <div class="toasts" id="toasts" aria-live="polite"></div>
      <div class="menu card" id="menu" hidden>
        <h3>暖港</h3>
        <button data-m="save">保存游戏</button>
        <button data-m="new">换一张新地图</button>
        <div class="settings">
          <label for="volMusic">音乐</label><input type="range" id="volMusic" min="0" max="1" step="0.05">
          <label for="volSfx">音效</label><input type="range" id="volSfx" min="0" max="1" step="0.05">
          <label for="rotMode">转动方式</label>
          <select id="rotMode"><option value="look">转动视角（镜头原地转）</option><option value="orbit">绕画面中心旋转</option></select>
        </div>
        <button data-m="help">操作说明</button>
        <div class="help" id="help" hidden>
          <p><b>移动镜头</b>：右键（或左键）拖动地面，或按 W A S D</p>
          <p><b>转动视角</b>：按住中键（滚轮）拖动，或按住 Q / E</p>
          <p><b>缩放</b>：滚轮，手机上双指捏合</p>
          <p><b>修路</b>：选"道路"后按住拖动</p>
          <p><b>取消</b>：右键单击或 Esc</p>
          <p>游戏每 30 秒自动保存在这台设备的浏览器里。</p>
        </div>
      </div>`;
    root.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) hooks.click(); });
    // sound
    const mute = $('#muteBtn', root);
    mute.addEventListener('click', () => { this.audio.muted = !this.audio.muted; hooks.audio({ muted: this.audio.muted }); this.renderAudio(); });
    $<HTMLInputElement>('#volMusic', root).addEventListener('input', e => { this.audio.music = Number((e.target as HTMLInputElement).value); hooks.audio({ music: this.audio.music }); });
    $<HTMLInputElement>('#volSfx', root).addEventListener('input', e => { this.audio.sfx = Number((e.target as HTMLInputElement).value); hooks.audio({ sfx: this.audio.sfx }); });
    $<HTMLSelectElement>('#rotMode', root).addEventListener('change', e => hooks.rotateMode((e.target as HTMLSelectElement).value as RotateMode));
    // speed
    $('#speed', root).addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) hooks.speed(Number(b.dataset.speed));
    });
    // menu
    const menu = $('#menu', root);
    $('#menuBtn', root).addEventListener('click', () => { menu.hidden = !menu.hidden; });
    menu.addEventListener('click', e => {
      const m = (e.target as HTMLElement).closest('button')?.dataset.m;
      if (m === 'save') { hooks.save(); menu.hidden = true; }
      if (m === 'new') {
        const b = (e.target as HTMLElement).closest('button')!;
        if (b.dataset.confirm) { hooks.newGame(); menu.hidden = true; delete b.dataset.confirm; b.textContent = '换一张新地图'; }
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
      const b = (e.target as HTMLElement).closest('button');
      if (b) hooks.tool((this.tool === b.dataset.type ? 'select' : b.dataset.type) as Tool);
    });
    $('#tSelect', root).addEventListener('click', () => hooks.tool('select'));
    $('#tDemolish', root).addEventListener('click', () => hooks.tool(this.tool === 'demolish' ? 'select' : 'demolish'));
    // info actions
    $('#info', root).addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      const b = this.selected;
      if (a === 'close') hooks.close();
      if (!b) return;
      if (a === 'upgrade') hooks.upgrade(b);
      if (a === 'upgradeAll') hooks.upgradeAll();
      if (a === 'demolish') {
        const btn = (e.target as HTMLElement).closest('button')!;
        if (btn.dataset.confirm) hooks.demolish(b);
        else { btn.dataset.confirm = '1'; btn.textContent = '再点一次确认拆除'; }
      }
      if (a === 'focus') hooks.focus(b);
    });
    this.renderItems();
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

  setGame(g: Game) { this.game = g; this.selected = null; this.infoKey = ''; this.renderInfo(); }
  setTool(t: Tool) {
    this.tool = t;
    const cat = BUILD_MENU.findIndex(c => c.items.includes(t as BuildingId));
    if (cat >= 0 && cat !== this.tab) this.tab = cat;
    this.renderItems();
    $('#tDemolish', this.root).classList.toggle('on', t === 'demolish');
    $('#tSelect', this.root).classList.toggle('on', t === 'select');
  }
  select(b: Bld | null) { this.selected = b; this.infoKey = ''; this.renderInfo(); }

  private renderItems() {
    $('#tabs', this.root).querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(i === this.tab)));
    const items = BUILD_MENU[this.tab].items;
    $('#items', this.root).innerHTML = items.map(t => {
      const d = BUILDINGS[t];
      const thumb = this.thumbs[t] ? `<img src="${this.thumbs[t]}" alt="">` : `<span class="road-ico"></span>`;
      return `<button class="item${this.tool === t ? ' on' : ''}" data-type="${t}" title="${d.desc}">
        ${thumb}<span class="nm">${d.name}${d.hotkey ? `<kbd>${d.hotkey}</kbd>` : ''}</span>
        <span class="cost">${icon('gold')}${d.cost.gold}${d.cost.planks ? ` ${icon('planks')}${d.cost.planks}` : ''}</span></button>`;
    }).join('');
  }

  // ---------- per-frame updates (throttled) ----------
  update(dt: number) {
    const g = this.game;
    // toasts
    for (const t of g.toasts.splice(0)) this.toast(t.text, t.kind);
    this.toastT += dt;
    if (this.toastT < 0.25) return;
    this.toastT = 0;
    const net = g.taxRate - g.upkeepRate;
    const demanded = new Set<string>(['fish']);
    if (g.pop.worker > 0) demanded.add('bread');
    $('#res', this.root).innerHTML = `
      <span class="chip gold" title="金币。税收 ${fmt(g.taxRate)}/分，维护费 ${fmt(g.upkeepRate)}/分">${icon('gold')}<b>${fmt(g.gold)}</b><i class="${net >= 0 ? 'up' : 'down'}">${net >= 0 ? '+' : ''}${Math.round(net)}/分</i></span>
      <span class="chip" title="农民（劳动力 ${g.workforce.peasant.have} / 需要 ${g.workforce.peasant.need}）">${icon('peasant')}<b>${g.pop.peasant}</b></span>
      <span class="chip" title="工人（劳动力 ${g.workforce.worker.have} / 需要 ${g.workforce.worker.need}）">${icon('worker')}<b>${g.pop.worker}</b></span>
      <span class="chip clock" title="${SEASONS[g.season].effect}">${icon(g.night > 0.5 ? 'moon' : g.season)}<b>第${g.year}年 ${SEASONS[g.season].name}</b><i>${String(Math.floor(g.hour)).padStart(2, '0')}:${String(Math.floor((g.hour % 1) * 60)).padStart(2, '0')}</i></span>
      <span class="chip weather" title="${WEATHER[g.weather.cur].effect}">${icon(g.weather.cur)}<b>${WEATHER[g.weather.cur].name}</b>${WEATHER[g.weather.cur].effect !== '一切正常' ? `<i>${WEATHER[g.weather.cur].effect}</i>` : ''}</span>
      <span class="sep"></span>
      ${GOOD_IDS.map(k => {
        const v = g.storage[k], low = v < 1 && demanded.has(k);
        return `<span class="chip good${low ? ' low' : ''}" title="${GOODS[k].name}：${fmt(v)} / ${g.cap}">${icon(k)}<b>${fmt(v)}</b></span>`;
      }).join('')}`;
    $('#speed', this.root).querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.speed) === g.speed));
    // affordability
    $('#items', this.root).querySelectorAll<HTMLButtonElement>('.item').forEach(b => {
      const d = BUILDINGS[b.dataset.type as BuildingId];
      b.classList.toggle('poor', !g.canAfford(d.cost));
    });
    // quest
    const qi = g.questIndex, q = QUESTS[qi];
    $('#quest', this.root).innerHTML = q
      ? `<span class="eyebrow">目标 ${qi + 1} / ${QUESTS.length}</span><p>${q.text}</p>${q.reward ? `<span class="reward">奖励 ${icon('gold')}${q.reward}${q.planks ? ` ${icon('planks')}${q.planks}` : ''}</span>` : ''}`
      : `<span class="eyebrow">全部完成</span><p>暖港已经是一座热闹的城市。接着建设吧！</p>`;
    this.updateInfo();
    // keep the quest card and info panel below the resource bar, which may wrap to two lines
    const top = (this.root.querySelector('.topbar') as HTMLElement).getBoundingClientRect().bottom + 10;
    if (innerWidth > 720) {
      $('#quest', this.root).style.top = `${top}px`;
      $('#info', this.root).style.top = `${top}px`;
    } else $('#quest', this.root).style.top = `${top}px`;
  }

  private toast(text: string, kind: string) {
    const box = $('#toasts', this.root);
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 4) box.firstElementChild!.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'good' ? 4200 : 2600);
  }

  // ---------- info panel ----------
  private renderInfo() {
    const box = $('#info', this.root);
    const b = this.selected;
    if (!b || !this.game) { box.hidden = true; return; }
    box.hidden = false;
    const d = BUILDINGS[b.type];
    const isHouse = b.type === 'house';
    const title = isHouse ? (b.tier === 'worker' ? '工人住宅' : '农舍') : d.name;
    let body = '';
    if (isHouse) {
      body = `
        <div class="row"><span>居民</span><b data-f="res"></b></div>
        <div class="row"><span>税收</span><b data-f="tax"></b></div>
        <h4>需求</h4><div data-f="needs" class="needs"></div>
        ${b.tier === 'peasant' ? `<button class="primary" data-a="upgrade">升级为工人住宅 <small>${icon('gold')}${UPGRADE_COST.gold} ${icon('planks')}${UPGRADE_COST.planks}</small></button>
        <p class="hint" data-f="block"></p><button class="ghost" data-a="upgradeAll">升级所有满足条件的农舍</button>` : ''}`;
    } else if (d.output) {
      body = `
        <div class="flow">${d.input ? `${icon(d.input)}<span>${GOODS[d.input].name}</span><em>→</em>` : ''}${icon(d.output)}<span>${GOODS[d.output].name}</span></div>
        <div class="bar"><i data-f="prog"></i></div>
        <div class="row"><span>${TIERS[d.workers!.tier].name}</span><b data-f="staff"></b></div>
        <div class="row"><span>产量</span><b data-f="rate"></b></div>
        ${d.needs === 'forest' ? `<div class="row"><span>附近树木</span><b data-f="trees"></b></div>` : ''}`;
    } else if (d.service) {
      body = `<div class="row"><span>覆盖半径</span><b>${d.radius} 格</b></div><div class="row"><span>覆盖住宅</span><b data-f="cov"></b></div>`;
    } else if (b.type === 'depot' || b.type === 'warehouse') {
      body = `<div class="row"><span>每种货物上限</span><b data-f="cap"></b></div>`;
    }
    box.innerHTML = `
      <header><h3>${title}</h3><button class="x" data-a="close" aria-label="关闭">×</button></header>
      <span class="pill" data-f="status"></span>
      <p class="desc">${isHouse && b.tier === 'worker' ? '工人的家。需要鱼、面包，以及集市和酒馆的覆盖。' : d.desc}</p>
      ${body}
      <footer>${d.upkeep ? `<span class="upkeep">维护费 ${d.upkeep}/分</span>` : '<span></span>'}${b.type !== 'depot' ? '<button class="danger" data-a="demolish">拆除</button>' : ''}</footer>`;
    this.updateInfo();
  }

  private updateInfo() {
    const b = this.selected;
    if (!b) return;
    const g = this.game;
    if (!g.buildings.has(b.id)) { this.hooks.close(); return; }
    const key = b.type + b.tier;
    if (key !== this.infoKey) { this.infoKey = key; this.renderInfo(); return; }
    const box = $('#info', this.root);
    const f = (k: string) => box.querySelector<HTMLElement>(`[data-f="${k}"]`);
    const d = BUILDINGS[b.type];
    const st = f('status');
    if (st) {
      const ok = b.type === 'house' ? b.status === '生活美满' : (b.status.startsWith('运转中') || !d.output);
      st.textContent = d.output || b.type === 'house' ? b.status : (b.connected ? '正常' : '没有连上道路');
      st.className = 'pill ' + (ok && b.connected ? 'ok' : 'bad');
    }
    if (b.type === 'house') {
      const T = TIERS[b.tier];
      f('res')!.textContent = `${b.residents} / ${T.cap} ${T.name}`;
      f('tax')!.textContent = `${(b.residents * T.tax * (0.4 + 0.6 * b.happy)).toFixed(1)} 金币/分`;
      f('needs')!.innerHTML = b.needs.map(n => `<div class="need"><span>${n.label}</span><span class="bar"><i style="width:${Math.round(n.value * 100)}%" class="${n.value > 0.95 ? 'ok' : n.value > 0.4 ? 'mid' : 'bad'}"></i></span></div>`).join('');
      const up = box.querySelector<HTMLButtonElement>('[data-a="upgrade"]');
      if (up) {
        const block = g.upgradeBlock(b);
        up.disabled = !!block;
        f('block')!.textContent = block ?? '条件已满足';
      }
    } else if (d.output) {
      f('prog')!.style.width = `${Math.round(b.progress * 100)}%`;
      f('staff')!.textContent = `${Math.round(b.staff * d.workers!.n)} / ${d.workers!.n}`;
      f('rate')!.textContent = `${((60 / d.cycle!) * b.staff * b.env).toFixed(1)} / 分`;
      const tr = f('trees');
      if (tr) tr.textContent = `${g.treesAround(b, d.radius!)} 棵（效率 ${Math.round(b.env * 100)}%）`;
    } else if (d.service) {
      let n = 0;
      g.buildings.forEach(h => { if (h.type === 'house' && g.covered(h, d.service!)) n++; });
      f('cov')!.textContent = b.connected ? `${n} 座` : '没有连上道路，无法服务';
    } else if (f('cap')) f('cap')!.textContent = String(g.cap);
  }
}
