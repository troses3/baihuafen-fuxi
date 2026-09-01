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
    const { hapticSwitch, hapticLabel } = getHapticElements();
    if (hapticLabel) {
      hapticLabel.click();
    }
    if (hapticSwitch) {
      hapticSwitch.click();
    }
  } catch (e) {}
}

let audioCtx = null;

// Ensure AudioContext is force-unlocked via silent buffer playback inside user gesture
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
    // WebKit mandatory unlock trick: play 1-sample silent buffer synchronously inside gesture
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', unlockAudioHaptics, { passive: true, once: false });
  window.addEventListener('touchend', unlockAudioHaptics, { passive: true, once: false });
  window.addEventListener('pointerdown', unlockAudioHaptics, { passive: true, once: false });
  window.addEventListener('click', unlockAudioHaptics, { passive: true, once: false });
}

let isHapticsAudioMuted = false;

export function setHapticsAudioMuted(muted) {
  isHapticsAudioMuted = Boolean(muted);
}

function playTapticThump(type = 'success') {
  if (isHapticsAudioMuted) return;
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

    if (type === 'success' || type === 'combo') {
      // 💥 Dual-component physical pop: high click + low body thump
      const oscHigh = audioCtx.createOscillator();
      const gainHigh = audioCtx.createGain();
      oscHigh.type = 'sine';
      oscHigh.frequency.setValueAtTime(440, now);
      oscHigh.frequency.exponentialRampToValueAtTime(140, now + 0.05);
      gainHigh.gain.setValueAtTime(0.85, now);
      gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      oscHigh.connect(gainHigh);
      gainHigh.connect(audioCtx.destination);
      oscHigh.start(now);
      oscHigh.stop(now + 0.05);

      const oscLow = audioCtx.createOscillator();
      const gainLow = audioCtx.createGain();
      oscLow.type = 'triangle';
      oscLow.frequency.setValueAtTime(180, now);
      oscLow.frequency.exponentialRampToValueAtTime(50, now + 0.07);
      gainLow.gain.setValueAtTime(0.75, now);
      gainLow.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      oscLow.connect(gainLow);
      gainLow.connect(audioCtx.destination);
      oscLow.start(now);
      oscLow.stop(now + 0.07);
    } else if (type === 'error' || type === 'dangerReset') {
      // 🚨 Warning dual buzz
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'tap' || type === 'optionSelect') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.03);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    }
  } catch (e) {}
}

/**
 * Trigger full-spectrum haptic feedback tailored for iOS, Android, WeChat, and Web Audio
 * @param {'tap' | 'modeSwitch' | 'hint' | 'menuToggle' | 'optionSelect' | 'dangerReset' | 'cardFlip' | 'success' | 'error' | 'clear' | 'combo' | 'celebration'} type
 */
export function triggerHaptic(type = 'tap') {
  // 1. Universal Acoustic Taptic Feedback (Works on iPhone/iPad/Desktop where navigator.vibrate is disabled)
  playTapticThump(type);

  // 2. WeChat / WeixinJSBridge hardware haptic for iOS WeChat browser
  try {
    if (typeof window !== 'undefined') {
      if (window.WeixinJSBridge && typeof window.WeixinJSBridge.invoke === 'function') {
        window.WeixinJSBridge.invoke('vibrateShort', {}, function() {});
      }
      if (window.wx && typeof window.wx.vibrateShort === 'function') {
        window.wx.vibrateShort({ type: type === 'error' ? 'heavy' : 'medium' });
      }
    }
  } catch (e) {}

  // 3. Android & Standards-compliant navigator.vibrate patterns (Single int + array for maximum device compatibility)
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'tap':
          navigator.vibrate(20);
          break;
        case 'hint':
        case 'modeSwitch':
          navigator.vibrate([25, 30, 20]);
          break;
        case 'optionSelect':
          navigator.vibrate(25);
          break;
        case 'menuToggle':
          navigator.vibrate([18, 40, 18]);
          break;
        case 'cardFlip':
          navigator.vibrate(28);
          break;
        case 'clear':
          navigator.vibrate([18, 25, 18]);
          break;
        case 'success':
          // Crisp, strong affirmative punch
          navigator.vibrate(50);
          try { navigator.vibrate([45, 30, 60]); } catch (e) {}
          break;
        case 'error':
          // Heavy alert tremor
          navigator.vibrate(90);
          try { navigator.vibrate([60, 40, 60, 40, 80]); } catch (e) {}
          break;
        case 'dangerReset':
          navigator.vibrate([70, 100, 90]);
          break;
        case 'combo':
          navigator.vibrate([35, 35, 35, 35, 50]);
          break;
        case 'celebration':
          navigator.vibrate([40, 50, 40, 50, 60, 70, 80]);
          break;
        default:
          navigator.vibrate(20);
      }
    } catch (e) {}
  }

  // 4. iOS 17.4+ WebKit Switch Hack with Rhythmic Time-Sequence
  try {
    switch (type) {
      case 'tap':
      case 'optionSelect':
        iosClick();
        break;

      case 'hint':
      case 'modeSwitch':
        iosClick();
        setTimeout(iosClick, 50);
        break;

      case 'menuToggle':
        iosClick();
        setTimeout(iosClick, 45);
        break;

      case 'cardFlip':
        iosClick();
        break;

      case 'clear':
        iosClick();
        setTimeout(iosClick, 40);
        break;

      case 'success':
        iosClick();
        setTimeout(iosClick, 65);
        break;

      case 'error':
        iosClick();
        setTimeout(iosClick, 45);
        setTimeout(iosClick, 95);
        break;

      case 'dangerReset':
        iosClick();
        setTimeout(iosClick, 130);
        break;

      case 'combo':
        iosClick();
        setTimeout(iosClick, 50);
        setTimeout(iosClick, 110);
        break;

      case 'celebration':
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
