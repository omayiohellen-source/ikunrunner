export class UI {
  constructor(audio) {
    this.audio = audio;
    this.score = document.querySelector("#score");
    this.bestScore = document.querySelector("#bestScore");
    this.startScreen = document.querySelector("#startScreen");
    this.gameOverScreen = document.querySelector("#gameOverScreen");
    this.resultText = document.querySelector("#resultText");
    this.hitText = document.querySelector("#hitText");
    this.muteButtons = [document.querySelector("#muteButton"), document.querySelector("#startMuteButton")];
    this.pauseButton = document.querySelector("#pauseButton");
  }

  bind(handlers) {
    document.querySelector("#startButton").addEventListener("click", handlers.onStart);
    document.querySelector("#restartButton").addEventListener("click", handlers.onRestart);
    this.pauseButton.addEventListener("click", handlers.onPause);
    document.querySelector("#jumpButton").addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handlers.onJump();
    });
    const duckButton = document.querySelector("#duckButton");
    duckButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handlers.onDuckStart();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
      duckButton.addEventListener(name, handlers.onDuckEnd);
    });
    document.querySelector("#copyLinkButton").addEventListener("click", () => this.copyLink());

    for (const button of this.muteButtons) {
      button.addEventListener("click", () => this.toggleSound());
    }
  }

  toggleSound() {
    const enabled = this.audio.toggle();
    this.setSoundLabel(enabled);
  }

  setSoundLabel(enabled) {
    this.muteButtons[0].textContent = enabled ? "♪" : "×";
    this.muteButtons[1].textContent = enabled ? "声音：开" : "声音：关";
  }

  showStart() {
    this.startScreen.classList.remove("hidden");
    this.gameOverScreen.classList.add("hidden");
  }

  showGame() {
    this.startScreen.classList.add("hidden");
    this.gameOverScreen.classList.add("hidden");
  }

  showGameOver({ score, best, obstacle, action }) {
    this.resultText.textContent = `本局得分 ${score}，最高分 ${best}`;
    this.hitText.textContent = `撞到了${obstacle}。正确动作：${action}`;
    this.gameOverScreen.classList.remove("hidden");
  }

  updateScore(score, best) {
    this.score.textContent = String(score);
    this.bestScore.textContent = String(best);
  }

  setPaused(paused) {
    this.pauseButton.textContent = paused ? "▶" : "Ⅱ";
    this.pauseButton.title = paused ? "继续" : "暂停";
  }

  async copyLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      document.querySelector("#copyLinkButton").textContent = "已复制";
    } catch {
      window.prompt("复制这个链接发给朋友：", url);
    }
  }
}
