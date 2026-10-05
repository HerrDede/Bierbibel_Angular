import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  @ViewChild('musicPlayer') private musicPlayer?: ElementRef<HTMLAudioElement>;

  isPlaying = false;
  musicError = '';

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
