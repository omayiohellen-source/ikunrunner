export class AudioManager {
  constructor(voiceUrls, rocketMusicUrl) {
    this.enabled = true;
    this.voices = voiceUrls.map((url) => {
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.volume = 0.95;
      return audio;
    });
    this.rocketMusic = new Audio(rocketMusicUrl);
    this.rocketMusic.preload = "auto";
    this.rocketMusic.volume = 0.82;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.rocketMusic.muted = !enabled;
    if (!enabled) this.stopRocketMusic();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  playRandomVoice() {
    if (!this.enabled || this.voices.length === 0) return;
    const original = this.voices[Math.floor(Math.random() * this.voices.length)];
    const audio = original.cloneNode();
    audio.volume = original.volume;
    audio.play().catch(() => {});
  }

  playRocketMusic() {
    if (!this.enabled) return;
    this.rocketMusic.currentTime = 0;
    this.rocketMusic.play().catch(() => {});
  }

  stopRocketMusic() {
    this.rocketMusic.pause();
    this.rocketMusic.currentTime = 0;
  }
}
