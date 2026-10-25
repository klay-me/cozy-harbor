# 素材来源与授权

上线前请逐项确认。

| 素材 | 来源 | 授权 | 用在哪里 |
|---|---|---|---|
| 乐器采样（尼龙吉他、马林巴、钢片琴、长笛、拨弦、低音提琴、钢片琴 celesta、卡林巴、陶笛、木琴、八音盒、手风琴、木鱼、管钟） | FluidR3_GM 音色库，经 [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) 转换 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)，可商用，需在游戏中署名 | `public/audio/*.json`，背景音乐和部分音效 |
| 所有 3D 模型 | 本项目用 Blender 脚本生成（`tools/models.py`） | 自有 | `public/models/town.glb` |
| 曲子 | 本项目原创（`src/audio/music.ts`） | 自有 | 背景音乐 |
| 环境音、部分音效 | 代码实时合成（`src/audio/sound.ts`） | 自有 | 海浪、风雨雷、鸟叫、蟋蟀等 |
| 字体 ZCOOL KuaiLe | Google Fonts | SIL Open Font License | 界面标题 |
| three.js | npm | MIT | 渲染 |

## 上线时需要做的

- 在游戏的"关于/制作人员"页面加上：Instrument samples from FluidR3_GM by Frank Wen, licensed under CC BY 3.0.
- 如果换成付费授权的音乐或外包模型，更新这张表。
