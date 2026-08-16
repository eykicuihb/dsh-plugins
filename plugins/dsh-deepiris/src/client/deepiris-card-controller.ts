/**
 * The DeepIris vision perception card's controller over the `deepiris`
 * settings namespace.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-plugins/client/deepiris-card-controller
 */

import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import type { SettingsScope, SettingsScopeSnapshot, SnapshotStore } from './card-form.ts'
import {
  CardForm, numberField, textField,
  type CardActions, type CardFieldState, type CardShell,
} from './card-form.ts'

/** Settings namespace for DeepIris. */
export const DEEPIRIS_NS = 'deepiris'

/** Default credential reference when unset. */
const DEFAULT_API_KEY_REF = 'DASHSCOPE_API_KEY'

/** Form field the credential control stages under. */
const API_KEY_FIELD = 'apiKey'

/** DeepIris settings shape. */
export interface DeepIrisSettings {
  provider?: string
  model?: string
  baseURL?: string
  apiKeyEnv?: string
  timeoutMs?: number
}

/** What the credentials domain last reported, and for which reference. */
interface CredentialState {
  ref: string
  configured: boolean
  writable: boolean
}

/** What the DeepIris card renders. */
export interface DeepIrisCardState extends CardShell {
  provider: CardFieldState
  model: CardFieldState
  baseURL: CardFieldState
  timeoutMs: CardFieldState
  apiKey: CardFieldState
  apiKeyConfigured: boolean
  apiKeyWritable: boolean
}

/** The registration-side face the DeepIris card's slot entry injects. */
export interface DeepIrisCardFace extends CardActions {
  hooks: {
    deepIrisCard: SnapshotStore<DeepIrisCardState>
  }
}

/** Bridges the `deepiris` scope and the credentials domain onto the card. */
export class DeepIrisCardController {
  private readonly form: CardForm<DeepIrisSettings>
  private readonly store: SnapshotStore<DeepIrisCardState>
  private credential: CredentialState = { ref: '', configured: false, writable: true }

  constructor(
    private readonly scope: SettingsScope<DeepIrisSettings>,
    private readonly api: Pick<IApiClient, 'credentials'>,
  ) {
    this.form = new CardForm(
      scope,
      [
        textField('provider'),
        textField('model'),
        textField('baseURL'),
        numberField('timeoutMs'),
      ],
      [{ field: API_KEY_FIELD, write: text => this.writeKey(text) }],
    )
    this.store = this.form.bind(() => this.projection())
    scope.subscribe(() => { void this.readCredential() })
    void this.readCredential()
  }

  private projection(): DeepIrisCardState {
    return {
      ...this.form.shell(),
      provider: this.form.field('provider'),
      model: this.form.field('model'),
      baseURL: this.form.field('baseURL'),
      timeoutMs: this.form.field('timeoutMs'),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: this.credential.writable,
    }
  }

  private async readCredential(): Promise<void> {
    const ref = refOf(this.scope.getSnapshot())
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true }
      this.store.set(this.projection())
    }
    let response: Awaited<ReturnType<IApiClient['credentials']['describe']>>
    try {
      response = await this.api.credentials.describe({ refs: [ref] })
    } catch {
      return
    }
    if (!response.result.ok || ref !== refOf(this.scope.getSnapshot())) return
    const view = response.result.value.credentials[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
    this.credential = next
    this.store.set(this.projection())
  }

  refreshCredential(ref: string): void {
    if (ref !== this.credential.ref) return
    void this.readCredential()
  }

  inject(): DeepIrisCardFace {
    return { hooks: { deepIrisCard: this.store }, ...this.form.actions() }
  }

  private async writeKey(value: string): Promise<boolean> {
    try {
      await this.api.credentials.set({ ref: refOf(this.scope.getSnapshot()), value })
    } catch {
      // ignore
    }
    await this.readCredential()
    return this.credential.configured
  }
}

function refOf(snapshot: SettingsScopeSnapshot<DeepIrisSettings>): string {
  const declared = snapshot.value?.apiKeyEnv
  if (declared !== undefined && declared.length > 0) return declared
  const provider = snapshot.value?.provider ?? 'dashscope'
  switch (provider) {
    case 'openai': return 'OPENAI_API_KEY'
    case 'anthropic': return 'ANTHROPIC_API_KEY'
    case 'zhipu': return 'ZHIPU_API_KEY'
    case 'gemini': return 'GEMINI_API_KEY'
    case 'ollama': return 'OLLAMA_API_KEY'
    case 'opencode':
    case 'opencode-go':
    case 'custom':
      return 'CUSTOM_VISION_API_KEY'
    default: return DEFAULT_API_KEY_REF
  }
}
