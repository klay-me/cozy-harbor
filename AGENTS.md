# AGENTS.md · 暖港 Cozy Harbor

用中文写提交信息、PR 标题和描述。先读 HANDOFF.md。

## 项目
- TypeScript + Vite 5 + Three.js r160，没有游戏引擎。玩法参考《纪元1800》+《冰汽时代》。
- 逻辑与渲染分离：src/sim/ 是纯逻辑（可在 Node 跑），src/render/ 只读 Game 状态。不要把玩法逻辑写进渲染层（以后可能移植 Unity）。
- 所有数值在 src/sim/data.ts，README 的数值表已过时。
- 除非任务明确要求，不要改造价、产量、维护费、半径等数值。

## 模型（tools/models*.py → public/models/town.glb）
- 生成：.blender/bin/python tools/models.py（约 20 秒），再 node tools/compress-models.mjs public/models/town.glb public/models/town.glb。改了任何 tools/models*.py 都必须重新生成并提交 town.glb。不要手改 GLB。
- 脚本顺序：models.py 定义 helper → exec models_m1.py 定义扩展模型 → 建基础及扩展模型 → models_resize.py（regroup 放大）→ models_m2.py（五条升级线全部在这里，按最终占地原生建，同一条线各级占地相同）→ models_anim.py。
- 1 Blender 单位 = 1 格；模型以占地中心为原点；正面朝 −Y（导出后 +Z）；渔业线正面是水那一侧。
- 顶层空物体名 = BUILDINGS[type].model。
- 尺度基准：门高约 0.42 宽 0.26（door() 默认）；窗约 0.24；层高 0.6–0.7；底板 (w−0.2, h−0.2, 0.10~0.12)。新模型以住宅和小人为参照，不要做成"巨人屋"。
- 画风：卡通、低面数、圆润小倒角；颜色优先用 P 调色板和仓库里已有的色值；描边由引擎生成（反向外壳），不要自己做描边。细节靠很多小物件（箱子、桶、栅栏、花、灯笼），不要用高面数曲面。
- 材质名前缀有含义，压缩时不能合并材质：C_ 普通色，G_ 夜里发光（窗户、灯），L_ 树叶（随季节变色），T_ 按实例染色。用 box/cyl/ball 等 helper 的 kind 参数控制。
- regroup() 会把部分模型的子物体整体缩放 1.3–1.5 倍。往这些模型上加动画部件时，位置和大小要手动乘缩放系数，不能缩放空物体本身（assets.ts 拆动画部件时会丢掉空物体的缩放）。新做或重做的模型一律按最终占地原生建，不要再 regroup。
- 要整个替换一个已有模型时，先删除旧的顶层物体及全部子物体再 root(name) 重建，确保导出里只有一份。

## 动画部件
- 动画部件是名字带前缀的空物体，子网格挂在它下面：spinz_ / spinx_（绕 Z/X 转：风车叶、水车、锯）、spiny_（绕竖轴：吊车、圆顶、风帽）、swingx_ / swingz_（摆动：斧头、锤子、钟、招牌）、flag_（旗子飘）、bob_（船在水上起伏）、drive_（车辆沿模型局部 X 轴来回开 ±1.3 格，掉头转 180°，只在 working 时动；车头朝 +X）。
- 前缀后面的名字决定节奏，逻辑在 src/render/animation.ts，由 src/render/view.ts 的 animate() 和画廊共同调用：saw、rotor、sails、gear、crane、dome、dish、axe、hammer、bell、firebell、skylight（温室天窗，工作时慢慢打开）有专门节奏；spin 类其他名字用默认速度；swing 类其他名字随风轻摆。
- spin 和 crane、axe、hammer 只在建筑 working 时动（港口 depot 吊车例外）；随风摆的、flag、bob 一直动。
- 需要新节奏时在共享的 animatePart() 里加一个按名字的分支，保持现有写法；需要新的动作类型时同时改 assets.ts 和 animation.ts，并在 gallery 里能看到。
- smoke_* 空物体标记烟囱口。
- 动画要"合理"：只给真的会动的东西加（船、吊车、水车、风扇、晾晒物、旗子、招牌），幅度小、节奏慢，跟现有建筑一个气质。

## 验证（每个 PR 都要做，结果写进 PR 描述）
1. npm run build 通过（含 tsc）。
2. node tools/check-models.mjs：本 PR 涉及的模型没有 ⚠（PR1 只记录既有警告作为基准，不为清除警告而改模型）；贴出这些模型改前改后的行；报告 town.glb 压缩后的大小（现阶段画面优先，不设上限）。
3. npm run build && python3 tools/test/gallery-shot.py <涉及的模型名>：看 #gallery-lines 和单个模型截图，确认尺度、底板与格子对齐、动画部件位置正确（摆动件可看 #gallery-one=名字-pose）。
4. 机器人：npx esbuild tools/test/bot.ts --bundle --platform=node --outfile=/tmp/bot.js && node /tmp/bot.js harbor 120 ，对比改前改后的人口、时代、问题列表，不能明显变差。
5. 改了 size 时：检查 tools/test/save-era2.json 读档后有没有建筑因为放不下被丢掉（Game 的反序列化里 canFit 那段）。有的话用机器人重新生成：node /tmp/bot.js harbor 120 tools/test/save-era2.json（确认生成的存档到了第二时代以上；分钟数不够就加大），并在 PR 里说明。
6. 已有截图测试：npm run build && python3 tools/test/shots.py tools/test/steps-example.json 能跑通（无头渲染很慢，截图保持默认缩放）。

## PR 规则
- 一个 PR 只做一件事（一条升级线或一类改动），改动可以独立回退。
- PR 描述写清楚：改了什么、为什么、占地改前改后、新增了哪些动画部件、验证结果。
- 不要顺手重构无关代码，不要改 README 以外的文档除非任务要求。
