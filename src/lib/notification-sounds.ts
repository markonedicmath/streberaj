"use client";

let context: AudioContext | undefined;
let successData: Promise<ArrayBuffer | undefined> | undefined;
let successBuffer: Promise<AudioBuffer | undefined> | undefined;

function loadSuccessData() {
  return (successData ??= fetch("/success.ogg")
    .then((response) => {
      if (!response.ok) throw new Error("Zvuk nije dostupan.");
      return response.arrayBuffer();
    })
    .catch(() => undefined));
}

function loadSuccessBuffer(audio: AudioContext) {
  return (successBuffer ??= loadSuccessData()
    .then((data) => (data ? audio.decodeAudioData(data) : undefined))
    .catch(() => undefined));
}

export function enableNotificationSounds() {
  void loadSuccessData();
  function unlock() {
    try {
      const Audio =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Audio) return;
      if (!context || context.state === "closed") context = new Audio();
      if (context.state !== "running") void context.resume().catch(() => {});
      void loadSuccessBuffer(context);
    } catch {
      // Sound is optional when the browser or device cannot provide audio.
    }
  }
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("pointerup", unlock, true);
  document.addEventListener("keydown", unlock, true);
  return () => {
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("pointerup", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    const audio = context;
    context = undefined;
    if (audio && audio.state !== "closed") void audio.close().catch(() => {});
  };
}

export function playNotificationSound(success = false) {
  const audio = context;
  if (!audio || audio.state !== "running") return;
  if (success) {
    void loadSuccessBuffer(audio).then((buffer) => {
      if (!buffer || audio.state !== "running") return;
      try {
        const source = audio.createBufferSource();
        const volume = audio.createGain();
        source.buffer = buffer;
        volume.gain.value = 0.6;
        source.connect(volume);
        volume.connect(audio.destination);
        source.onended = () => {
          source.disconnect();
          volume.disconnect();
        };
        source.start();
      } catch {
        // Audio playback must not interrupt saving or notifications.
      }
    });
    return;
  }
  const start = audio.currentTime + 0.01;
  function note(
    frequency: number,
    offset: number,
    duration: number,
    volume: number,
  ) {
    const oscillator = audio!.createOscillator();
    const gain = audio!.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start + offset);
    gain.gain.setValueAtTime(0, start + offset);
    gain.gain.linearRampToValueAtTime(volume, start + offset + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
    oscillator.connect(gain);
    gain.connect(audio!.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  try {
    note(783.99, 0, 0.17, 0.055);
    note(1046.5, 0.09, 0.2, 0.045);
  } catch {
    // A suspended audio device must not interrupt notifications or saving.
  }
}
