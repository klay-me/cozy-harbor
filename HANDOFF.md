# 暖港 Cozy Harbor · 交接文档

更新于 2026-10-26，对应提交 `903368d` 之后。新会话接手前先读这一份，再看 `CREDITS.md`。`README.md` 里的数值表已经过时，以 `src/sim/data.ts` 为准。

---

## 1. 项目是什么

- 一款 3渲2（卡通描边 3D）风格的**城市建造经营**游戏：外表温馨，玩法有压力。
- 玩法参考《纪元 1800》（生产链、人口阶层、服务覆盖），生存压力参考《冰汽时代》（冬季、食物、燃料、疾病、火灾、罢工）。
- 目标是一款作者自己喜欢、别人也会喜欢、**能赚钱**的游戏。主要平台是 PC，打算上 Steam，目前先做网页版。
- 技术栈：TypeScript + Vite 5 + Three.js r160，没有用游戏引擎。所有模型都由 Blender Python 脚本生成。

### 已经定下来的设计决定

| 项目 | 决定 |
|---|---|
| 名字 | 暖港 / Cozy Harbor |
| 时代 | 四个时代，达到条件后自动进入下一时代：田园 → 手工业 → 工业 → 现代城市 |
| 进入时代的条件 | 农民 60 人加教堂 → 工人 120 人加铁匠铺 → 技工 150 人加市政厅 |
| 研究 | 研究树，分生产、民生、环境三支；第四时代有无限研究 |
| 电力 | 全城共用一个电网 |
| 结局 | 无尽模式，没有终局 |
| 地图 | 固定的手工设计地图；目前只有一张随机种子图（`MAP_SEED = 11`），手工设计地图还没做 |
| 素材 | 免费素材或自制，版权上线前统一处理（见 `CREDITS.md`） |
| 音乐 | 由 Claude 决定；目前是原创曲谱加 FluidR3 乐器采样 |

### 链接

- 仓库：https://github.com/klay-me/cozy-harbor （`main` 分支）
- 在线试玩：https://claude.ai/artifact/FTrQyw1MZr2B4dvrNd6MNW （claude.ai Artifact，第 13 版，仅作者可见）
- 设计文档：claude.ai 文档《暖港》设计文档（doc id `b3998300-658f-4db2-abd2-ae46946e9090`），含数值表和各系统说明

---

## 2. 现在游戏里有什么

### 基础
- 地图 128×128，有海、河、湖、森林，以及铁矿和煤矿（每条矿脉由几块 2×2 的矿点组成）。
- 道路可以架桥跨过河湖，但不能跨海。
- 建筑大小不一（2×2 到 4×4），长方形建筑放置时按 **F** 旋转 90 度。
- 港口是起点；港口、仓库、大型仓库都可以作为路网起点。建筑要连上路网才能工作。
- 全城共用一个库存，上限等于各仓储建筑容量之和加研究加成。

### 人口与需求
- 四个阶层：农民 4 人/户、工人 8、技工 12、市民 16。每个阶层有自己的食物、舒适品、服务和燃料需求，见 `TIERS`。
- 住宅住满且幸福度达到 80 后，付费升级到下一阶层（需要下一时代已解锁）。
- 幸福度由六部分组成：食物 30、舒适品 15、公共服务 20、环境 10、温暖 15、健康 10。欠薪和火灾会扣分。
- 食物按"饱食"计算：鱼和蔬菜 1，面包 2，罐头 3。吃的种类越多越开心。吃不饱会减员。
- 新住户搬进来的条件：吃得饱、食物库存够吃两天以上，或者该阶层人口不到 12 人（开局时的保底规则）。

### 生产
- 每座建筑都有生产周期、原料和产出，信息面板会显示"每天产多少、可以供应几座下游建筑"（`src/ui/chain.ts`）。
- 工坊可以暂停：暂停后工人去别处干活，维护费只收 1/4。没有工人的空闲建筑也只收 1/4。
- 拆除返还一半金币和材料（向上取整）。
- 季节影响产量：菜园和麦田冬天停产，渔场冬天减产。天气也有加成或减产。

### 时间与气候
- 一天 240 秒；每季默认 4 天，菜单里可选 3、4、6 天。
- 气温随季节、昼夜和年份变化，而且一年比一年冷。低于 8°C 住宅就要烧燃料：前两个时代烧柴火，工业时代以后烧煤，现代城市用电。
- 第三时代可以建煤炉房集中供暖。

### 压力系统（数值在 `data.ts` 的 FIRE / PLAGUE / CRIME / STRIKE / DEBT / HUNGER）
- **火灾**：会随机起火并蔓延，夏天晴天更容易着火。有消防覆盖的会被扑灭，没有的会烧光。
- **瘟疫**：会在住宅之间传染，冬天更容易爆发。有医疗覆盖的好得快、不容易扩散；空置的住宅会立即解除。
- **治安**：从第二时代开始，不开心的住户会偷库存里的货物或金币，巡警所能压住。
- **罢工**：连续欠薪 2 天，或者某阶层平均幸福度低于 35，就会罢工。
- **欠债**：金币为负数时每天扣幸福度。
- 秋天会提醒冬天大约需要多少食物和燃料。每天天亮出日报。

### 服务覆盖（参考纪元）
- 消防、医疗、治安，以及集市、酒馆、教堂、学校、诊所、医院、剧院，都是从门口的路出发沿道路走（范围 = 半径 × 1.6 格），走得到的才算覆盖。
- 公园、污染、集中供暖仍然按直线半径计算。
- 选中或放置这类建筑时，会同时显示所有同类建筑的范围：这一座的路是黄色，其他几座是橙色，覆盖到的建筑染蓝，没覆盖到的染红。

### 界面
- **顶栏**：金币（每天收支）、食物够吃几天、人口、幸福度、电力、污染、研究、日期和季节进度、气温、天气、关键货物（带涨跌箭头）。点数字可以打开账本。
- **账本（L）**：金币和货物两页，按天显示收入与支出，并列出最近几天的历史。
- **其他面板**：仓库与商船（G，买卖货物）、研究（T）、污染视图（P）。
- **消息分四处**：
  - 操作反馈在建造栏上方，一次一条。
  - 城里发生的事在左侧，点一下镜头跳过去，地面闪一个圈。
  - 里程碑是居中的横幅。
  - 所有消息都进消息记录（铃铛按钮，或按 M）。
- **头顶气泡**：着火、瘟疫、饥饿、受冻、罢工、暂停、缺工人、缺原料、仓库满、缺电、断路，以及可以升级（只在镜头拉近时显示）。点气泡可以选中那座建筑。

### 画面与动画
- 卡通渲染加反向外壳描边；昼夜、四季、雨雪雾、雷暴；夜里窗户和路灯会发光（bloom）。
- 烟囱冒烟，着火时有火焰和黑烟；街上有行人和运货推车。
- 模型里的动画部件：
  - 风车叶片、水车、圆锯、风力发电机
  - 港口和大型仓库的吊车
  - 伐木场的斧头、铁匠铺的锤子、矿井绞车
  - 教堂整点敲钟（6、12、18 点），城里着火时消防队警钟摇
  - 旗帜、酒馆招牌、晾布、行会齿轮、研究所的圆顶和雷达、供暖厂风帽、渔船

### 声音
- **背景音乐**：每种情绪两首轮换（四季、夜晚、雨天、危机）。
  - 配器随时代变化：第二时代加竖琴、单簧管，第三时代加弦乐、圆号，第四时代换电钢琴、颤音琴。
  - 着火、瘟疫、饥荒或长期欠薪时切换到危机曲。
- **环境音**：海浪、风、雨、雷、鸟、海鸥、蟋蟀，以及 Kenney 的白天环境音。
- **建筑声**（`src/audio/town.ts`，代码合成）：靠镜头近的建筑会发声，按屏幕位置左右分声道，拉近更响。
- **界面、放置、拆除音效**：用的是 Kenney CC0 采样。

---

## 3. 代码地图

```
src/
  main.ts            启动、存读档、输入、主循环（把 game/view/hud/sound 串起来）
  sim/               纯逻辑，不依赖 DOM 和 three.js，可以在 Node 里跑
    data.ts          所有数值：货物、食物、时代、阶层、建筑、研究、季节、天气、灾害常数
    world.ts         地图生成：地形、海与河湖判定、森林、矿点
    game.ts          Game 类：放置与拆除、路网、覆盖、生产、人口、灾害、日报、账本、存档（v2）、任务
  render/
    view.ts          场景总控：建筑实例、道路与桥、虚影、覆盖叠加层、动画部件、头顶气泡、烟火、声源统计
    terrain.ts       地形网格与着色器（道路画在地面上；污染、覆盖、矿点都是 DataTexture）
    assets.ts        读取 GLB，合并几何体，烘焙顶点色和发光、树叶、染色标记，生成描边外壳，拆出动画部件
    models.ts        按建筑类型、阶层、变体取模型
    env.ts           昼夜、天气、季节、雾、雨雪粒子
    people.ts        行人与运货推车
    smoke.ts         烟雾与火焰粒子
    decor.ts / camera.ts / toon.ts / shared.ts / thumbs.ts（建造栏缩略图）
  ui/
    hud.ts           所有 DOM 界面：顶栏、建造栏、信息面板、研究、仓库、账本、消息系统、菜单
    chain.ts         生产链说明文字（每天产出、能供应几座下游）
    icons.ts         手绘 SVG 图标
  audio/
    sound.ts         总线、环境音、音效、加载采样（sfx.json）
    music.ts         曲谱、按时代配器、轮换与变奏
    town.ts          建筑声景（声床加定时事件）
  dev/gallery.ts     模型画廊：index.html#gallery、#gallery-big、#gallery-anim、#gallery-one=NAME（可加 -pose）
public/
  models/town.glb    所有模型（量化压缩后约 4.7MB）
  audio/*.json       乐器采样（每种乐器一个文件，{音名: base64 mp3}）和 sfx.json
tools/
  models.py          Blender 主脚本，依次 exec models_m1.py、models_resize.py、models_anim.py，然后导出 GLB
  compress-models.mjs  gltf-transform 量化（KHR_mesh_quantization），不用 meshopt，因为 meshopt 解码要 wasm
  glb-to-json.mjs    把 GLB 转成内嵌 base64 的 glTF JSON（Artifact 发布时用）
  extract-samples.mjs  从 FluidR3_GM 抽取乐器采样
  pack-sfx.py        把 Kenney 音效打包成 sfx.json
  test/              自动化测试：bot.ts、shots.py、存档、步骤示例
```

### 关键约定

- **逻辑与渲染分离**：`sim/` 不碰画面，`render/` 只读 Game 的状态。Game 用几个版本号通知画面更新：`bVersion` 建筑、`rVersion` 道路、`tVersion` 树木、`pVersion` 污染。
- **固定步长**：模拟每步 0.25 秒；`game.advance(秒)` 可以不经过渲染直接快进（测试用）。
- **账本**：滚动 60 秒窗口，分 10 秒一桶；界面显示时乘以 `PER_DAY = 4`，换算成每天。
- **坐标**：
  - 格子坐标 (x, z) 范围 0..127；世界坐标 = 格子坐标 − W/2。
  - Blender 里正面朝 −Y，导出到 three.js 后朝 +Z。
  - 1 个 Blender 单位 = 1 格；模型以占地中心为原点。
- **模型命名**：
  - 顶层空物体就是一个模型，名字对应 `BUILDINGS[type].model`。
  - 动画部件是空物体，名字前缀决定动作方式：`spinz_`、`spinx_`、`spiny_`、`swingx_`、`swingz_`、`flag_`、`bob_`。前缀后面的名字（crane、axe、bell、sign 等）决定节奏，逻辑在 `view.ts` 的 `animate()`。
  - 空物体 `smoke_*` 标记烟囱口。
- **材质名前缀**：`C_` 普通色，`G_` 夜里发光，`L_` 树叶（随季节变色），`T_` 按实例染色。压缩时**不能**合并材质，因为名字里带着这些标记。
- **regroup 的缩放**：`models_resize.py` 的 `regroup()` 会给部分模型的子物体整体缩放（1.3 到 1.5 倍）。往这些模型上加动画部件时要手动乘以缩放系数，不能缩放空物体本身，因为 assets.ts 拆动画部件时会丢掉空物体的缩放。
- **存档**：键名 `cozy-harbor-save-v2`，30 秒自动保存。建筑尺寸变化后，旧存档里放不下的建筑会在读档时被去掉（`canFit`）。
- **消息**：`game.notify(text, kind, { cat, at, icon })`。`cat` 取 `action`、`alert`、`milestone`、`report`；`at` 传建筑或格子坐标，用于点击定位。不要把 kind 直接当 CSS 类名，因为会和 `.info` 面板撞名，界面里统一用 `k-` 和 `c-` 前缀。
- **调试入口**：浏览器里的 `window.__cozy` 提供 game、view、hud、sound、select、setTool。

---

## 4. 常用操作

```bash
npm install
npm run dev                  # 本地开发
npm run build                # tsc 类型检查加打包到 dist/
```

### 重新生成模型（改了 tools/models*.py 之后）

```bash
# Blender 的 Python 模块（bpy 4.5）装在仓库外的 .blender/ 目录（用 uv 建的虚拟环境，已在 .gitignore 里）
uv venv .blender --python 3.11 && uv pip install --python .blender/bin/python bpy==4.5.*
.blender/bin/python tools/models.py                                         # 大约 20 秒，导出约 11.6MB
node tools/compress-models.mjs public/models/town.glb public/models/town.glb  # 压到约 4.7MB
```

在 `index.html#gallery-anim` 看动画建筑，`#gallery-one=bigwarehouse` 看单个模型，名字后面加 `-pose` 可以看摆动部件摆到最高点的样子。

### 乐器采样与音效

```bash
# 乐器采样：先从 raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/<乐器>-mp3.js 下载到某个目录
node tools/extract-samples.mjs <那个目录>
# 音效：准备好 kcity/ 和 kui/ 两个文件夹（来源见脚本开头），在它们所在的目录运行
python3 /path/to/tools/pack-sfx.py
```

### 测试

```bash
# 机器人试玩：自动建城，打印人口、问题、研究进度。参数依次是 地图种子、模拟分钟数、可选的存档输出路径
npx esbuild tools/test/bot.ts --bundle --platform=node --outfile=/tmp/bot.js && node /tmp/bot.js 11 120
# 无头截图：需要 Python 的 playwright 加 Chromium；会读取 tools/test/save-era2.json（第二时代末的城）
npm run build && python3 tools/test/shots.py tools/test/steps-example.json
```

无头 Chromium 用的是 swiftshader 软件渲染，很慢。镜头拉远时截图可能超时，所以截图要保持默认缩放或拉近。

### 发布到 claude.ai Artifact（试玩链接）

1. `npm run build`，然后把 `dist/` 复制到一个临时目录。
2. 运行 `node tools/glb-to-json.mjs <临时目录>/models/town.glb <临时目录>/models/town.json`，再删掉 town.glb。Artifact 的文件类型受限，游戏会先尝试读 GLB，失败了再读 JSON。
3. 把 `assets/*.css` 内联进 index.html。
4. 用 Artifact 工具发布 index.html，并通过 `files` 映射带上 `assets/*.js`、`audio/*.json`、`models/town.json`。哈希文件名每次构建都会变，旧文件要在映射里设为 null。
5. URL 保持 https://claude.ai/artifact/FTrQyw1MZr2B4dvrNd6MNW 不变（从别的会话发布要传 `url`）。

另外，`.github/workflows/pages.yml` 可以把 main 分支发布到 GitHub Pages，前提是在仓库设置里打开 Pages（Source 选 GitHub Actions）。

---

## 5. 环境限制（Claude 云端会话里）

- 网络只能访问 GitHub（含 raw.githubusercontent.com）、npm 和 PyPI；Freesound、Kenney 官网、OpenGameArt、Wikimedia 都打不开。
- 需要访问新的 GitHub 仓库时要先 add_repo；`git clone` 不能拉取未授权的仓库，但 raw 文件可以直接下载。
- Artifact 的内容安全策略不允许读取 data: URL，所以 GLB 要转成 JSON 再在内存里重新打包。wasm 能否使用不确定，所以不用 meshopt。
- 单个 Artifact 文件上限 16MB；目前最大的是 models/town.json，约 5.8MB。
- `npm install` 有时很慢（几分钟）。这次的 gltf-transform 是手动复制进 node_modules 的，`package-lock.json` 还没同步；下次在网络正常时跑一次 `npm install`。

---

## 6. 待办与已知问题

**还没做的大块**
- [ ] 手工设计的固定地图（目前只有随机种子 11 一张）
- [ ] Steam 版：用 Electron 或 Tauri 打包、存档放到本地文件、加入成就、设置界面、制作人员名单（FluidR3 采样需要署名）
- [ ] 平衡性要靠真人试玩来调：火灾频率、冬季缺粮、欠债惩罚、商船价格
- [ ] 建筑声音如果换成真实录音，需要作者自己下载 Kenney《RPG Audio》《Impact Sounds》等素材包后提供

**已知问题和小尾巴**
- [ ] README 里的数值表过时了（还是早期只有两个阶层时的内容），需要按 data.ts 重写
- [ ] 顶栏内容太多，宽屏下也会折成两到三行，需要重新排版
- [ ] 测试存档里有 65 户可升级，所以"可升级"气泡只在镜头拉近时显示；之后可以考虑做成开关
- [ ] package-lock.json 没有同步新加的开发依赖（@gltf-transform/*）
- [ ] 部分放大的模型只是整体缩放加了些点缀，还可以逐个重做得更精细
- [ ] 音乐和音效的音量比例、左侧消息的频率、头顶气泡的数量都还没经过真人确认

---

## 7. 和作者合作的方式

- 作者用中文交流；他是 Python 全栈开发者，最近主要通过 AI 代理写代码，所以说明要讲清楚"改了什么、为什么、怎么用"，不要大段贴代码。
- 他会一边试玩一边成批提问题（每轮 4 到 7 条），喜欢参考《纪元》和《冰汽时代》的做法。
- 每轮的流程：改代码 → `npm run build` → 跑机器人和截图验证 → 发布 Artifact → 提交并推送 GitHub → 用中文回复，说清楚每一条是怎么改的。
- 提交信息用中文，结尾加 Claude 署名行。
