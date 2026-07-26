# ikun跑酷

一个可公开部署的纯静态 Canvas 2D 跑酷网页游戏。用户无需安装、无需登录，打开浏览器链接后点击“开始游戏”即可游玩。

## 当前玩法

| 障碍物 | 正确动作 |
| --- | --- |
| 贴地篮球 | 跳跃 |
| 浮空篮球 | 下蹲 |
| 篮球框 | 二连跳 |

操作：

- 电脑：`Space` / `W` / `↑` 跳跃，空中再次按为二连跳；`S` / `↓` 下蹲；`P` / `Esc` 暂停。
- 手机：屏幕右半边点击跳跃；左半边长按下蹲；底部也有“跳跃”“下蹲”两个大按钮。
- 竖屏会提示“建议横屏游玩”，但仍允许继续玩。

随机事件：

- 游戏中会随机出现“刮风中”事件。
- 刮风期间角色受到的重力降低，跳跃高度会变高。
- 刮风也会让跑动速度小幅提高，障碍物会略快靠近。
- 风力/重力变化触发前 2 秒会显示“重力变化”“风力变化”提示。
- 风力场与重力场现在分别随机触发；风力场提示“风力变化”，重力场提示“重力变化”。

道具：

- 护盾：拾取后 10 秒内无视所有障碍。
- 双倍积分：拾取后 10 秒内新增时间分变为 2 倍。
- 火箭：拾取后飞行 10 秒，飞行期间不会碰到障碍物；落地后获得 3 秒护盾，并播放火箭音乐。
- 道具生成会避开障碍物和其他道具，减少图标重合。

## 素材映射

原始文件包含两张明确用途图片和一个图标文件；没有明确的篮球或篮球框素材，因此篮球与篮球框使用生成的高对比透明 PNG，并在游戏中保持粗描边绘制。

| 原始素材 | 新路径 | 用途 |
| --- | --- | --- |
| `人物.png` | `public/assets/images/player.png` | 玩家角色 |
| `进入游戏的背景图.png` | `public/assets/images/background.png` | 开始界面背景 |
| `游戏图标.jpg` | `public/assets/images/icon.jpg` | 页面图标 |
| 生成素材 | `public/assets/images/basketball.png` | 贴地/浮空篮球障碍 |
| 生成素材 | `public/assets/images/basketball-hoop.png` | 篮球框障碍 |
| `rap.mp3` | `public/assets/audio/voice-01.mp3` | 随机动作语音 |
| `你干嘛.mp3` | `public/assets/audio/voice-02.mp3` | 随机动作语音 |
| `哇真的是你呀.mp3` | `public/assets/audio/voice-03.mp3` | 随机动作语音 |
| `唱.mp3` | `public/assets/audio/voice-04.mp3` | 随机动作语音 |
| `跳.mp3` | `public/assets/audio/voice-05.mp3` | 随机动作语音 |
| `music.mp4` | `public/assets/audio/rocket-music.mp4` | 火箭飞行音乐 |

补充要求：循环背景音乐已删除。`背景音乐.mp3` 没有放入 `public/assets`，代码也不会加载或播放背景音乐。

## 本地开发

```bash
npm install
npm run dev
```

打开终端输出的网址，例如 `http://localhost:5173/`。手机测试时，电脑和手机连接同一个 Wi-Fi，然后访问 Vite 输出的 Network 地址。

## 打包

```bash
npm run build
```

构建产物会生成在 `dist/`，里面是纯静态文件，可部署到任意静态托管平台。

预览打包结果：

```bash
npm run preview
```

## GitHub Pages 部署

本项目 `vite.config.js` 使用 `base: "./"`，可以适配 GitHub Pages 的仓库子路径，避免 JS、图片、MP3 在 `/repo-name/` 下 404。

完整命令示例：

```bash
git init
git add .
git commit -m "Deploy ikun runner web game"
git branch -M main
git remote add origin https://github.com/<your-name>/<repo-name>.git
git push -u origin main
npm install
npm run build
npm install -D gh-pages
npx gh-pages -d dist
```

预计网址格式：

```text
https://<your-name>.github.io/<repo-name>/
```

## Cloudflare Pages 部署

推荐平台：Cloudflare Pages。它对静态站点和移动端资源缓存支持很好。

设置：

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: 项目根目录

预计网址格式：

```text
https://<project-name>.pages.dev/
```

也可以绑定自己的域名。

## Vercel 部署

设置：

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

预计网址格式：

```text
https://<project-name>.vercel.app/
```

## 部署注意

- 不要使用 `file:///C:/...` 分享给别人；那只在本机有效。
- 对外分享时，请使用 GitHub Pages、Cloudflare Pages 或 Vercel 生成的 HTTPS 网址。
- 音频是动作语音，浏览器会在用户点击/触控后播放；播放失败会被静默处理，不会中断游戏。

## zhouge-game.cloud 部署修复

如果 `zhouge-game.cloud` 显示的是项目根目录或 `README.md`，说明部署平台正在发布源码根目录，而不是 Vite 构建后的 `dist/`。

正确设置：

```text
Build command: npm run build
Publish / Output directory: dist
Install command: npm install 或 npm ci
Root directory: 仓库根目录
```

本仓库已经加入以下部署配置：

- `vercel.json`：Vercel 使用 `npm run build` 并发布 `dist`。
- `netlify.toml`：Netlify 使用 `npm run build` 并发布 `dist`。
- `wrangler.toml`：Cloudflare Pages 使用 `dist` 作为输出目录。
- `.github/workflows/deploy-pages.yml`：GitHub Pages 构建并发布 `dist`。

Cloudflare Pages 控制台设置：

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
```

Vercel 控制台设置：

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Netlify 控制台设置：

```text
Build command: npm run build
Publish directory: dist
```

部署后请重新触发一次生产部署，并清理浏览器缓存后访问 `https://zhouge-game.cloud/`。
