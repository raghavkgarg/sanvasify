(function () {
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isMac = /macintosh|mac os x/.test(ua) && !isIos;
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isAndroid = /android/.test(ua);
  const isStandalone = (window.navigator.standalone) ||
    (window.matchMedia('(display-mode: standalone)').matches);

  let deferredPrompt;

  // Handle Android/Chrome Native Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;

    if (!isStandalone) {
      checkAndShowPrompt('android-native');
    }
  });

  // Main logic to decide which prompt to show
  if (!isStandalone) {
    if (isIos && isSafari) {
      checkAndShowPrompt('ios');
    } else if (isMac && isSafari) {
      checkAndShowPrompt('mac-safari');
    } else if (isAndroid && !deferredPrompt) {
      checkAndShowPrompt('android-manual');
    }
  }

  function checkAndShowPrompt(type) {
    const lastShown = localStorage.getItem('pwa_prompt_shown');
    const now = Date.now();

    // Show only if not shown in the last 24 hours (unless it's the native trigger)
    if (
      !lastShown || (now - lastShown) > 86400000 || type === 'android-native'
    ) { // Always show native prompt if available
      if (document.readyState === 'complete') {
        setTimeout(() => showPrompt(type), 3000); // Delay for better UX
      } else {
        window.addEventListener('load', () => {
          setTimeout(() => showPrompt(type), 3000); // Delay for better UX
        });
      }
    }
  }

  function showPrompt(type) {
    if (document.getElementById('ios-pwa-prompt')) return; // Prevent multiple prompts

    const prompt = document.createElement('div');
    prompt.id = 'ios-pwa-prompt';

    let content = '';
    if (type === 'android-native') {
      content = `
        <div style="font-weight: 700; margin-bottom: 8px;">Install Sanvasify</div>
        <p style="font-size: 0.9rem; margin-bottom: 12px; color: var(--color-text-secondary);">Install the app on your device for a faster, better experience.</p>
        <button id="pwa-install-btn" style="background: var(--color-accent); color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; width: 100%; cursor: pointer;">Install Now</button>
      `;
    } else if (type === 'ios') {
      content = `
        <div style="font-weight: 700; margin-bottom: 4px;">Install Sanvasify</div>
        <div class="pwa-prompt-steps">
          1. Click The <strong>Three Dots (...)</strong> at the bottom right.<br>
          2. Tap the <strong>'Share'</strong> button <img src="/images/safari-share.svg" alt="Share" class="pwa-share-icon">.<br>
          3. Scroll down and select <strong>'(+) Add to Home Screen'</strong>.
        </div>
      `;
    } else if (type === 'mac-safari') {
      content = `
        <div style="font-weight: 700; margin-bottom: 4px;">Install Sanvasify</div>
        <div class="pwa-prompt-steps">
          1. Click the <strong>Share</strong> button <img src="/images/safari-share.svg" alt="Share" class="pwa-share-icon"> in the toolbar, or open the <strong>File</strong> menu.<br>
          2. Select <strong>'Add to Dock...'</strong>.
        </div>
      `;
    } else { // android-manual
      content = `
        <div style="font-weight: 700; margin-bottom: 4px;">Install Sanvasify</div>
        <div class="pwa-prompt-steps">
          1. Click The <strong>Three Dots (⋮)</strong> at the top right.<br>
          2. Select <strong>'Install app'</strong> or <strong>'Add to Home screen'</strong>.
        </div>
      `;
    }

    prompt.innerHTML = `
      <div class="pwa-prompt-content">
        <button class="pwa-prompt-close" id="pwa-close">✕</button>
        ${content}
      </div>
    `;
    document.body.appendChild(prompt);

    if (document.getElementById('pwa-install-btn')) {
      document.getElementById('pwa-install-btn').addEventListener(
        'click',
        async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
              prompt.style.display = 'none';
            }
            deferredPrompt = null;
          }
        },
      );
    }

    document.getElementById('pwa-close').addEventListener('click', () => {
      prompt.style.display = 'none';
      localStorage.setItem('pwa_prompt_shown', Date.now());
    });
  }
})();
