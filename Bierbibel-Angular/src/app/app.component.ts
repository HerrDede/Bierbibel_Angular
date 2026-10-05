import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, inject, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  @ViewChild('musicPlayer') private musicPlayer?: ElementRef<HTMLAudioElement>;

  isPlaying = false;
  musicError = '';
  isDarkMode = true;

  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const savedTheme = this.document.defaultView?.localStorage.getItem('bierbibel-dark-mode');
    this.isDarkMode = savedTheme === null || savedTheme === 'true';
    this.applyTheme();
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();

    if (isPlatformBrowser(this.platformId)) {
      this.document.defaultView?.localStorage.setItem('bierbibel-dark-mode', String(this.isDarkMode));
    }
  }

  private applyTheme(): void {
    this.document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
  }

  async toggleMusic(): Promise<void> {
    const player = this.musicPlayer?.nativeElement;
    if (!player) {
      this.musicError = 'Der Audioplayer ist nicht verfügbar.';
      return;
    }

    this.musicError = '';
    if (!player.paused) {
      player.pause();
      this.isPlaying = false;
      return;
    }

    try {
      await player.play();
      this.isPlaying = true;
    } catch (error: unknown) {
      this.musicError = error instanceof Error
        ? `Musik konnte nicht gestartet werden: ${error.message}`
        : 'Musik konnte nicht gestartet werden.';
    }
  }

}
