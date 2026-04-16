import {
  Component, signal, inject, OnInit, OnDestroy, computed,
  ChangeDetectionStrategy, ViewChild, ElementRef, AfterViewInit
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-mfa-verificar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormsModule
  ],
  templateUrl: './mfa-verificar.html',
  styleUrl:    './mfa-verificar.scss'
})
export class MfaVerificarComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);

  @ViewChild('d0') d0!: ElementRef<HTMLInputElement>;
  @ViewChild('d1') d1!: ElementRef<HTMLInputElement>;
  @ViewChild('d2') d2!: ElementRef<HTMLInputElement>;
  @ViewChild('d3') d3!: ElementRef<HTMLInputElement>;
  @ViewChild('d4') d4!: ElementRef<HTMLInputElement>;
  @ViewChild('d5') d5!: ElementRef<HTMLInputElement>;

  loading      = signal(false);
  errorMessage = signal<string | null>(null);
  codeComplete = signal(false);
  private static readonly OTP_TTL = 60; // segundos, debe coincidir con el backend
  timeLeft = signal(MfaVerificarComponent.OTP_TTL);

  email = '';
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  readonly timeDisplay = computed(() => {
    const m = Math.floor(this.timeLeft() / 60).toString().padStart(2, '0');
    const s = (this.timeLeft() % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  });

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    if (!this.email) {
      this.router.navigate([ROUTES.LOGIN]);
      return;
    }

    const sentAt  = parseInt(sessionStorage.getItem('mfa_sent_at') ?? '0', 10);
    const elapsed = sentAt ? Math.floor((Date.now() - sentAt) / 1000) : 0;
    this.timeLeft.set(Math.max(0, MfaVerificarComponent.OTP_TTL - elapsed));

    this.startTimer();
  }

  ngAfterViewInit(): void {
    this.d0.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val   = input.value.replace(/\D/g, '').slice(-1);
    input.value = val;
    input.classList.toggle('filled', val !== '');
    this.errorMessage.set(null);
    this.refreshCodeComplete();

    if (val && index < 5) {
      this.inputAt(index + 1).focus();
    }
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const el = this.inputAt(index);
      if (el.value) {
        el.value = '';
        el.classList.remove('filled');
        this.refreshCodeComplete();
      } else if (index > 0) {
        this.inputAt(index - 1).focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.inputAt(index - 1).focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.inputAt(index + 1).focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? '';
    if (!pasted) return;

    for (let i = 0; i < 6; i++) {
      const el  = this.inputAt(i);
      const val = pasted[i] ?? '';
      el.value  = val;
      el.classList.toggle('filled', val !== '');
    }
    this.refreshCodeComplete();

    const nextEmpty = [0,1,2,3,4,5].find(i => this.inputAt(i).value === '') ?? 5;
    this.inputAt(nextEmpty).focus();
  }

  async onSubmit(): Promise<void> {
    if (!this.codeComplete()) return;

    const code = [0,1,2,3,4,5].map(i => this.inputAt(i).value).join('');
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.authService.mfaVerify(this.email, code);
      sessionStorage.removeItem('mfa_sent_at');
    } catch (err: any) {
      const msg = err?.error?.error ?? 'Código incorrecto. Inténtalo de nuevo.';
      this.errorMessage.set(msg);
      this.clearDigits();
    } finally {
      this.loading.set(false);
    }
  }

  private inputAt(index: number): HTMLInputElement {
    const refs = [this.d0, this.d1, this.d2, this.d3, this.d4, this.d5];
    return refs[index].nativeElement;
  }

  private refreshCodeComplete(): void {
    const allFilled = [0,1,2,3,4,5].every(i => this.inputAt(i).value !== '');
    this.codeComplete.set(allFilled);
  }

  goBack(): void {
    sessionStorage.removeItem('mfa_sent_at');
    this.router.navigate([ROUTES.LOGIN]);
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      if (this.timeLeft() <= 0) {
        this.clearTimer();
        return;
      }
      this.timeLeft.update(t => t - 1);
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private clearDigits(): void {
    for (let i = 0; i < 6; i++) {
      this.inputAt(i).value = '';
      this.inputAt(i).classList.remove('filled');
    }
    this.codeComplete.set(false);
    this.d0.nativeElement.focus();
  }
}
