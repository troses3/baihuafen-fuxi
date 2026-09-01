// Advanced Multi-Tier Web Haptic Engine (iOS 17.4+ Switch Hack & Android/Standard Vibration API)

let hapticSwitch = null;
let hapticLabel = null;

function getHapticElements() {
  if (typeof document === 'undefined') return { hapticSwitch: null, hapticLabel: null };
  if (!hapticSwitch) {
    hapticSwitch = document.getElementById('ios-haptic-trigger-switch');
    hapticLabel = document.getElementById('ios-haptic-trigger-label');

    if (!hapticSwitch) {
      hapticSwitch = document.createElement('input');
      hapticSwitch.type = 'checkbox';
      hapticSwitch.setAttribute('switch', '');
      hapticSwitch.id = 'ios-haptic-trigger-switch';
      hapticSwitch.style.position = 'fixed';
      hapticSwitch.style.opacity = '0';
      hapticSwitch.style.pointerEvents = 'none';
      hapticSwitch.style.top = '-9999px';
      hapticSwitch.style.left = '-9999px';
      hapticSwitch.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hapticSwitch);
    }

    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.htmlFor = 'ios-haptic-trigger-switch';
      hapticLabel.id = 'ios-haptic-trigger-label';
      hapticLabel.style.position = 'fixed';
      hapticLabel.style.opacity = '0';
      hapticLabel.style.pointerEvents = 'none';
      hapticLabel.style.top = '-9999px';
      hapticLabel.style.left = '-9999px';
      hapticLabel.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hapticLabel);
    }
  }
  return { hapticSwitch, hapticLabel };
}

// iOS Taptic click via simulated switch toggle
function iosClick() {
  try {
    const { hapticLabel } = getHapticElements();
    if (hapticLabel) {
      hapticLabel.click();
    }
  } catch (e) {}
}

let audioCtx = null;

// Ensure AudioContext is ready and resumed on user interaction
export function unlockAudioHaptics() {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', unlockAudioHaptics, { passive: true, once: false });
  window.addEventListener('touchend', unlockAudioHaptics, { passive: true, once: false });
  window.addEventListener('pointerdown', unlockAudioHaptics, { passive: true, once: false });
}

function playTapticThump(type = 'success') {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (type === 'success' || type === 'combo') {
      // Crisp mechanical pop (180Hz -> 45Hz sub-bass thump in 35ms)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'error' || type === 'dangerReset') {
      // Deeper low-frequency double thud
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.07);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === 'tap' || type === 'optionSelect') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.02);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.02);
    }
  } catch (e) {}
}

/**
 * Trigger full-spectrum haptic feedback tailored for both iOS (Taptic acoustic + switch) and Android (vibrate patterns)
 * @param {'tap' | 'modeSwitch' | 'hint' | 'menuToggle' | 'optionSelect' | 'dangerReset' | 'cardFlip' | 'success' | 'error' | 'clear' | 'combo' | 'celebration'} type
 */
export function triggerHaptic(type = 'tap') {
  // 1. Universal Acoustic Taptic Feedback (Works on iPhone/iPad/Desktop where navigator.vibrate is disabled)
  playTapticThump(type);

  // -------------------------------------------------------------
  // 2. Android & Standards-compliant navigator.vibrate patterns (Crisp & punchy)
  // -------------------------------------------------------------
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'tap':
          navigator.vibrate(18);
          break;
        case 'hint':
        case 'modeSwitch':
          navigator.vibrate([25, 30, 20]);
          break;
        case 'optionSelect':
          navigator.vibrate(22);
          break;
        case 'menuToggle':
          navigator.vibrate([18, 40, 18]);
          break;
        case 'cardFlip':
          navigator.vibrate(25);
          break;
        case 'clear':
          navigator.vibrate([18, 25, 18]);
          break;
        case 'success':
          // Snappy affirmative tactile double pulse
          navigator.vibrate([35, 30, 45]);
          break;
        case 'error':
          // Heavy alert tremor
          navigator.vibrate([55, 35, 55, 35, 70]);
          break;
        case 'dangerReset':
          navigator.vibrate([70, 100, 90]);
          break;
        case 'combo':
          navigator.vibrate([30, 35, 30, 35, 45]);
          break;
        case 'celebration':
          navigator.vibrate([35, 50, 35, 50, 60, 70, 80]);
          break;
        default:
          navigator.vibrate(20);
      }
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // 2. iOS 17.4+ WebKit Switch Hack with Rhythmic Time-Sequence
  // -------------------------------------------------------------
  try {
    switch (type) {
      case 'tap':
      case 'optionSelect':
        iosClick();
        break;

      case 'hint':
      case 'modeSwitch':
        // Crisp dual switch toggle for mode shift
        iosClick();
        setTimeout(iosClick, 50);
        break;

      case 'menuToggle':
        // Double pop for menu open/close
        iosClick();
        setTimeout(iosClick, 45);
        break;

      case 'cardFlip':
        iosClick();
        break;

      case 'clear':
        // Snappy double click
        iosClick();
        setTimeout(iosClick, 40);
        break;

      case 'success':
        // Crisp affirmative double tap (哒-哒)
        iosClick();
        setTimeout(iosClick, 65);
        break;

      case 'error':
        // Rapid triple warning jitter (哒哒哒)
        iosClick();
        setTimeout(iosClick, 45);
        setTimeout(iosClick, 95);
        break;

      case 'dangerReset':
        // Heavy warning double impulse with strong interval (咚……咚)
        iosClick();
        setTimeout(iosClick, 130);
        break;

      case 'combo':
        // Escalating rhythm
        iosClick();
        setTimeout(iosClick, 50);
        setTimeout(iosClick, 110);
        break;

      case 'celebration':
        // Triumphant 4-burst rhythm
        iosClick();
        setTimeout(iosClick, 70);
        setTimeout(iosClick, 140);
        setTimeout(iosClick, 220);
        break;

      default:
        iosClick();
    }
  } catch (e) {}
}

export default triggerHaptic;
