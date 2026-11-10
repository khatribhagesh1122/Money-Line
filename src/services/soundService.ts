// Sound & Voice service disabled per user preference (Notification Bell & Voice features removed)
class SoundService {
  private isMuted: boolean = true;
  private voiceLanguage: 'en' | 'hi' = 'en';

  public getIsAudioUnlocked(): boolean {
    return false;
  }

  public onUnlockChange(_listener: (unlocked: boolean) => void): () => void {
    return () => {};
  }

  public unlockAudioAndBackgroundSession() {}

  public clearQueue() {}

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setLanguage(lang: 'en' | 'hi') {
    this.voiceLanguage = lang;
  }

  public getLanguage(): 'en' | 'hi' {
    return this.voiceLanguage;
  }

  public setPlayChimes(_enabled: boolean) {}

  public playChime(_type: 'alert' | 'target' | 'stop' = 'alert') {}

  public speak(_text: string, _type: 'alert' | 'target' | 'stop' = 'alert') {}
}

export const soundService = new SoundService();
