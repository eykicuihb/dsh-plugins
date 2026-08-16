import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { DeepIrisCard } from './DeepIrisCard.tsx'
import { DEEPIRIS_NS, DeepIrisCardController } from './deepiris-card-controller.ts'
import { deepirisLocaleEn, deepirisLocaleZh } from './locales.ts'

export const name = 'deepiris'
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

export function apply(ctx: ClientContext): void {
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
