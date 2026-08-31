// Web Haptic Utility supporting iOS 17.4+ Switch Hack and Standard navigator.vibrate

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

/**
 * Triggers tactile haptic feedback across iOS (17.4+ switch hack) and Android (navigator.vibrate)
 * @param {'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning'} type
 */
export function triggerHaptic(type = 'light') {
  // 1. Android / Desktop standard Vibration API
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'success') {
        navigator.vibrate([20, 50, 25]);
      } else if (type === 'error') {
        navigator.vibrate([40, 60, 40, 60, 40]);
      } else if (type === 'heavy' || type === 'warning') {
        navigator.vibrate(50);
      } else if (type === 'medium') {
        navigator.vibrate(30);
      } else {
        navigator.vibrate(15);
      }
    } catch (e) {}
  }

  // 2. iOS 17.4+ Safari / WebKit switch haptic hack
  try {
    const { hapticLabel } = getHapticElements();
    if (hapticLabel) {
      hapticLabel.click();
    }
  } catch (e) {}
}
