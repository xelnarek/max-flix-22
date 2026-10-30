import { sound } from './sound.ts';

export interface ComicIntroCallbacks {
  onComplete: () => void;
  onStartGame?: () => void;
}

export class ComicIntroManager {
  private callbacks: ComicIntroCallbacks;
  private overlayEl: HTMLElement | null = null;
  private autoTimer: number | null = null;
  private active: boolean = false;

  constructor(callbacks: ComicIntroCallbacks) {
    this.callbacks = callbacks;
  }

  public isRunning(): boolean {
    return this.active;
  }

  public start() {
    if (this.active) return;
    this.active = true;

    this.removeOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'comic-intro-overlay';
    overlay.className = 'comic-intro-overlay';

    const comicJokes = [
      {
        title: "PIĄTEK, GODZINA 15:59!",
        quote: "„Pani Aniu, przyjechały 4 palety gresu 120x280 z Włoch... Kierownik Walczak zablokował bramę numer B4!”",
        sub: "SZALONA AKCJA NA MAGAZYNIE MAX-FLIZ • CZAS DOKONAĆ ODBIORU!",
        heroIcon: "👷‍♂️",
      },
      {
        title: "ALARM W SHOWROOMIE!",
        quote: "„Ktoś rozlał espresso na najdroższy marmur Calacatta Gold i wyłączył wózki widłowe!”",
        sub: "RUSZAJ DO AKCJI • ZBIERAJ FUGI I ZABEZPIECZ ZAMÓWIENIA VIP!",
        heroIcon: "🚜",
      },
      {
        title: "KONTROLA JAKOŚCI B4!",
        quote: "„Inspektor BHP i Dyrektor Król-Leto krążą po alejkach z dyscyplinarkami!”",
        sub: "UŻYJ MOCY BOHATERA I POKAŻ KTO TU RZĄDZI LOGISTYKĄ!",
        heroIcon: "💪",
      },
      {
        title: "SZYBKA DOSTAWA!",
        quote: "„Pan Roman pędzi z sanitariatami, a serwisanci szukają dylatacji w złym sektorze!”",
        sub: "UNIKAJ KOLIZJI • MAGAZYN NIE ŚPI, MAGAZYN WALCZY O KAŻDY GRES!",
        heroIcon: "📦",
      },
      {
        title: "ODPRAWA KWARTALNA!",
        quote: "„Bosman z Krakowa idzie z raportem... Lepiej miej zebrane wszystkie VIP-y!”",
        sub: "FINAŁOWA ROZGRYWKA • POKAŻ IM CO TO ZNACZY LOGISTYKA MAX-FLIZ!”",
        heroIcon: "⚓",
      }
    ];

    const joke = comicJokes[Math.floor(Math.random() * comicJokes.length)];

    overlay.innerHTML = `
      <div class="comic-backdrop"></div>
      <div class="comic-card">
        <div class="comic-header-badge">
          <span class="comic-badge-icon">💥</span>
          <span class="comic-badge-text">MAX-FLIZ SHOWDOWN 3D</span>
        </div>
        
        <div class="comic-hero-avatar">${joke.heroIcon}</div>
        
        <h2 class="comic-title">${joke.title}</h2>
        <div class="comic-speech-bubble">
          <p class="comic-quote">${joke.quote}</p>
        </div>
        
        <div class="comic-subtitle">${joke.sub}</div>

        <div class="comic-action-row">
          <button id="btn-comic-skip" class="btn-comic-skip">⏩ POMIŃ I WEJDŹ DO MENU</button>
        </div>

        <div class="comic-timer-bar">
          <div id="comic-timer-fill" class="comic-timer-fill" style="animation-duration: 18.0s;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlayEl = overlay;

    try {
      sound.playPickup(2);
    } catch (e) {
      console.warn('Comic audio notice:', e);
    }

    const skipBtn = document.getElementById('btn-comic-skip');
    const handleSkip = (e?: Event) => {
      if (e) e.preventDefault();
      this.stop();
    };

    if (skipBtn) {
      skipBtn.addEventListener('click', handleSkip);
      skipBtn.addEventListener('touchend', handleSkip, { passive: false });
    }

    // Auto-advance after 18 seconds
    this.autoTimer = window.setTimeout(() => {
      this.stop();
    }, 18000);
  }

  public stop() {
    if (!this.active) return;
    this.active = false;

    if (this.autoTimer !== null) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }

    if (this.overlayEl) {
      this.overlayEl.classList.add('fade-out');
      // Wait for fade animation to finish
      setTimeout(() => {
        this.removeOverlay();
        this.callbacks.onComplete();
      }, 500);
    } else {
      this.callbacks.onComplete();
    }
  }

  private removeOverlay() {
    if (this.overlayEl && this.overlayEl.parentElement) {
      this.overlayEl.parentElement.removeChild(this.overlayEl);
      this.overlayEl = null;
    }
  }
}
