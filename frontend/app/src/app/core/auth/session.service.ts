import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config';
import { Persona } from '../models';
import { DEFAULT_PERSONA_ID, PERSONAS } from './personas';

const PERSONA_KEY = 'aegisflow_persona_v2';

interface DemoLoginResponse {
  token: string;
}

/**
 * Holds the "who am I" state. In HTTP mode switching persona performs a demo-login and keeps the JWT in
 * memory only (a page reload logs in again as the remembered persona). In browser mode it just switches.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly _user = signal<Persona>(PERSONAS[0]);
  private _token: string | null = null;

  readonly user = this._user.asReadonly();
  readonly role = computed(() => this._user().role);
  readonly personas = PERSONAS;
  readonly mode = APP_CONFIG.apiMode;

  get token(): string | null {
    return this._token;
  }

  /** Called once at startup (app initializer). */
  async init(): Promise<void> {
    await this.switchTo(this.rememberedPersonaId());
  }

  async switchTo(personaId: string): Promise<void> {
    const persona = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];
    if (APP_CONFIG.apiMode === 'http') {
      const res = await firstValueFrom(
        this.http.post<DemoLoginResponse>(`${APP_CONFIG.apiBaseUrl}/auth/demo-login`, {
          personaId: persona.id,
        }),
      );
      this._token = res.token;
    }
    this._user.set(persona);
    try {
      localStorage.setItem(PERSONA_KEY, persona.id);
    } catch {
      // storage unavailable: the choice just won't survive a reload
    }
  }

  private rememberedPersonaId(): string {
    try {
      return localStorage.getItem(PERSONA_KEY) ?? DEFAULT_PERSONA_ID;
    } catch {
      return DEFAULT_PERSONA_ID;
    }
  }
}
