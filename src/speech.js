export const isSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text) {
  if (!isSupported() || !text) return false;
  window.speechSynthesis.cancel();            // drop stale announcements
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = document.documentElement.lang || 'en';
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeech() {
  if (isSupported()) window.speechSynthesis.cancel();
}