import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { DeepIrisCard } from './DeepIrisCard.tsx'
import { DEEPIRIS_NS, DeepIrisCardController } from './deepiris-card-controller.ts'
import { deepirisLocaleEn, deepirisLocaleZh } from './locales.ts'

export const name = 'deepiris'
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

const DEEPIRIS_STYLE_ID = 'dsh-deepiris-styles'
const DEEPIRIS_CSS = `
.dsh-deepiris-card {
  list-style: none;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1));
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,0.03));
  transition: border-color .16s, background .16s;
  margin-bottom: 12px;
}
.dsh-deepiris-card:hover {
  border-color: var(--dsw-alias-label-dimmed, rgba(255,255,255,0.2));
}
.dsh-deepiris-card.open {
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.06));
  border-color: var(--dsw-alias-label-dimmed, rgba(255,255,255,0.2));
}
.dsh-deepiris-header {
  width: 100%;
  appearance: none;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
}
.dsh-deepiris-header:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, #4d82ff);
  outline-offset: -2px;
}
.dsh-deepiris-headText {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dsh-deepiris-name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary, #fff);
}
.dsh-deepiris-description {
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary, rgba(255,255,255,0.6));
}
.dsh-deepiris-chevron {
  flex: none;
  color: var(--dsw-alias-label-tertiary, rgba(255,255,255,0.6));
  transition: transform .16s;
}
.dsh-deepiris-chevron.open {
  transform: rotate(180deg);
}
.dsh-deepiris-body {
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1));
  margin: 0 16px;
  padding-bottom: 8px;
}
.dsh-deepiris-readOnly {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary, rgba(255,255,255,0.6));
}
.dsh-deepiris-pending {
  flex: none;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  font-weight: 500;
  white-space: nowrap;
  background: var(--dsw-alias-bg-module-platform, rgba(255,255,255,0.1));
  color: var(--dsw-alias-label-secondary, rgba(255,255,255,0.8));
}
.dsh-deepiris-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 4px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1));
}
.dsh-deepiris-failed {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-error, #ff4d4f);
}
.dsh-deepiris-discard,
.dsh-deepiris-save {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 5px 14px;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}
.dsh-deepiris-discard {
  border-color: var(--dsw-alias-border-l2, rgba(255,255,255,0.1));
  background: none;
  color: var(--dsw-alias-label-secondary, rgba(255,255,255,0.8));
}
.dsh-deepiris-discard:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary, #fff);
  border-color: var(--dsw-alias-label-dimmed, rgba(255,255,255,0.2));
}
.dsh-deepiris-save {
  background: var(--dsw-alias-label-primary, #fff);
  color: var(--dsw-alias-bg-layer-3, #121212);
}
.dsh-deepiris-discard:disabled,
.dsh-deepiris-save:disabled {
  opacity: 0.4;
  cursor: default;
}
.dsh-deepiris-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
}
.dsh-deepiris-field + .dsh-deepiris-field {
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1));
}
.dsh-deepiris-field-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-deepiris-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary, #fff);
}
.dsh-deepiris-badges {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.dsh-deepiris-badge {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  white-space: nowrap;
  font-weight: 500;
  background: var(--dsw-alias-bg-module-platform, rgba(255,255,255,0.1));
  color: var(--dsw-alias-label-secondary, rgba(255,255,255,0.8));
}
.dsh-deepiris-badge-muted {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary, rgba(255,255,255,0.6));
}
.dsh-deepiris-reset {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary, rgba(255,255,255,0.8));
  cursor: pointer;
}
.dsh-deepiris-reset:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary, #fff);
}
.dsh-deepiris-input {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.1));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,0.03));
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary, #fff);
}
.dsh-deepiris-input:focus-visible {
  outline: none;
  border-color: var(--dsw-alias-brand-primary, #4d82ff);
}
.dsh-deepiris-input:disabled {
  color: var(--dsw-alias-label-tertiary, rgba(255,255,255,0.6));
  cursor: default;
}
.dsh-deepiris-input-invalid {
  border-color: var(--dsw-alias-label-error, #ff4d4f);
}
.dsh-deepiris-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary, rgba(255,255,255,0.6));
}
.dsh-deepiris-invalid {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-error, #ff4d4f);
}
`

function injectDeepIrisStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(DEEPIRIS_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = DEEPIRIS_STYLE_ID
  style.setAttribute('data-plugin', '@eykicuihb/dsh-deepiris')
  style.textContent = DEEPIRIS_CSS
  document.head.appendChild(style)
}

export function apply(ctx: ClientContext): void {
  injectDeepIrisStyles()

  const { api } = (ctx.get('connection') || {}) as ConnectionHandle

  if (ctx.locale?.register) {
    ctx.effect(
      () => ctx.locale.register(DEEPIRIS_NS, { en: deepirisLocaleEn, zh: deepirisLocaleZh }),
      'dsh-deepiris: locales',
    )
  }

  const scope = ctx.settingsScope.bind({ namespace: DEEPIRIS_NS })
  const deepiris = new DeepIrisCardController(scope, api)

  if (ctx.remote?.$on) {
    ctx.effect(
      () => ctx.remote.$on('credentials/updated', (ref: string) => { deepiris.refreshCredential(ref) }),
      'dsh-deepiris: credential invalidations',
    )
  }

  if (ctx.slots?.inject) {
    ctx.slots.inject('settings.plugin.item', function* () {
      yield ctx.slots.register({
        name: 'settings.plugin.item',
        id: 'deepiris',
        order: 30,
        locale: DEEPIRIS_NS,
        inject: () => deepiris.inject(),
      }, DeepIrisCard)
    })
  }
}

apply.inject = inject

export default {
  name,
  inject,
  apply,
}
