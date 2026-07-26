import "./styles.css";
import { Game } from "./game.js";
import { AudioManager } from "./audio.js";
import { UI } from "./ui.js";

const base = import.meta.env.BASE_URL;
const assetUrl = (path) => `${base}${path}`.replace(/\/{2,}/g, "/");

const assets = {
  images: {
    player: assetUrl("assets/images/player.png"),
    basketball: assetUrl("assets/images/basketball.png"),
    hoop: assetUrl("assets/images/basketball-hoop.png"),
    background: assetUrl("assets/images/background.png"),
    icon: assetUrl("assets/images/icon.jpg"),
  },
  voices: [
    assetUrl("assets/audio/voice-01.mp3"),
    assetUrl("assets/audio/voice-02.mp3"),
    assetUrl("assets/audio/voice-03.mp3"),
    assetUrl("assets/audio/voice-04.mp3"),
    assetUrl("assets/audio/voice-05.mp3"),
  ],
  rocketMusic: assetUrl("assets/audio/rocket-music.mp4"),
};

document.documentElement.style.setProperty("--start-bg", `url("${assets.images.background}")`);
document.querySelector("#gameIcon").src = assets.images.icon;

const audio = new AudioManager(assets.voices, assets.rocketMusic);
const ui = new UI(audio);
const game = new Game({
  canvas: document.querySelector("#gameCanvas"),
  assets,
  audio,
  ui,
});

ui.bind({
  onStart: () => game.start(),
  onRestart: () => game.start(),
  onPause: () => game.togglePause(),
  onJump: () => game.jump(),
  onDuckStart: () => game.setDuck(true),
  onDuckEnd: () => game.setDuck(false),
});

game.init();
