# 素材来源与授权

上线前请逐项确认。

| 素材 | 来源 | 授权 | 用在哪里 |
|---|---|---|---|
| 乐器采样（竖琴、弦乐合奏、圆号、单簧管、大提琴、颤音琴、电钢琴、定音鼓、小号；以及尼龙吉他、马林巴、钢片琴、长笛、拨弦、低音提琴、钢片琴 celesta、卡林巴、陶笛、木琴、八音盒、手风琴、木鱼、管钟） | FluidR3_GM 音色库，经 [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) 转换 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)，可商用，需在游戏中署名 | `public/audio/*.json`，背景音乐和部分音效 |
| 放置/拆除/旋转音效、白天环境音 | Kenney《Starter Kit City Builder》([GitHub](https://github.com/KenneyNL/Starter-Kit-City-Builder)) | CC0，可商用，无需署名 | `public/audio/sfx.json` |
| 界面音效（点击、打开/关闭面板、错误、确认等） | Kenney《Interface Sounds》([GitHub 镜像](https://github.com/Calinou/kenney-interface-sounds)) | CC0，可商用，无需署名 | `public/audio/sfx.json` |
| 所有 3D 模型 | 本项目用 Blender 脚本生成（`tools/models.py`） | 自有 | `public/models/town.glb` |
| 曲子 | 本项目原创（`src/audio/music.ts`） | 自有 | 背景音乐 |
| 小雨 rain_l | [alex36917「Rain」](https://freesound.org/people/alex36917/sounds/524605/)，经 [Blanket](https://github.com/rafaelmardojai/blanket) 剪辑 | CC BY，可商用，**需署名** | `public/audio/world.json` |
| 海浪 waves | [Luftrum「Ocean waves」](https://freesound.org/people/Luftrum/sounds/48412/)，经 Blanket 剪辑 | CC BY，可商用，**需署名** | 同上 |
| 风 wind | [felix.blume](https://freesound.org/people/felix.blume/sounds/217506/)，经 Blanket | CC0 | 同上 |
| 鸟叫 birds | [kvgarlic](https://freesound.org/people/kvgarlic/sounds/156826/)，经 Blanket | CC0 | 同上 |
| 夏夜蟋蟀 night | [Lisa Redfern（SoundBible）](https://soundbible.com/2083-Crickets-Chirping-At-Night.html)，经 Blanket | 公有领域 | 同上 |
| 火焰 fire | [ezwa（SoundBible）](https://soundbible.com/1543-Fireplace.html)，经 Blanket | 公有领域 | 同上（着火的建筑） |
| 溪水 water | [gluckose](https://freesound.org/people/gluckose/sounds/333987/)，经 Blanket | CC0 | 同上（渔场、水车、锯木厂） |
| 大雨、狂风、雷声 3 段、海鸥、羊叫、人群 | [Moodist](https://github.com/remvze/moodist) 的 `public/sounds/`（rain/heavy-rain、nature/howling-wind、rain/thunder、animals/seagulls、animals/sheep、urban/crowd） | Moodist 声明其音效为 CC0 或 Pixabay Content License，两者都可商用、免署名，但没有逐个标明来源。**上 Steam 前建议逐个核对或替换** | 同上 |
| 远雷、工厂机器声、锯木声、推车声、水花 | rubberduck 的 CC0 音效包（OpenGameArt），经 [lavenderdotpet/CC0-Public-Domain-Sounds](https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds) | CC0 | 同上 |
| 砍树、打铁、矿镐、敲打、织机、吱呀声、碰杯、钱币、铃 | Kenney《Impact Sounds》《RPG Audio》，经同一个仓库 | CC0 | 同上 |
| 汽笛、蒸汽、风机、孩子说话声（无录音时的备用）等 | 代码实时合成（`src/audio/town.ts`、`src/audio/sound.ts`） | 自有 | 建筑声；录音加载完成前的替代音 |
| 字体 ZCOOL KuaiLe | Google Fonts | SIL Open Font License | 界面标题 |
| three.js | npm | MIT | 渲染 |

## 上线时需要做的

- 在游戏的"关于/制作人员"页面加上：
  - Instrument samples from FluidR3_GM by Frank Wen, licensed under CC BY 3.0.
  - "Rain" by alex36917 and "Ocean waves" by Luftrum (freesound.org), licensed under CC BY, edited by the Blanket project.
- 重新打包环境音：`python3 tools/pack-world.py <blanket 声音目录> <moodist 声音目录> <CC0 仓库目录>`（来源和用法见脚本开头）。
- 如果换成付费授权的音乐或外包模型，更新这张表。
