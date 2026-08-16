import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { DeepIrisCard } from './DeepIrisCard.tsx'
import { DEEPIRIS_NS, DeepIrisCardController } from './deepiris-card-controller.ts'
import { deepirisLocaleEn, deepirisLocaleZh } from './locales.ts'

export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

export function apply(ctx: ClientContext): void {
  ctx.locale.define(DEEPIRIS_NS, 'en', deepirisLocaleEn)
  ctx.locale.define(DEEPIRIS_NS, 'zh', deepirisLocaleZh)

  const t = ctx.locale.t(DEEPIRIS_NS)

  const deepiris = new DeepIrisCardController(
    () => ctx.settingsScope(DEEPIRIS_NS),
    t,
    () => ctx.locale.get(),
    (handle: ConnectionHandle) => ctx.remote(handle).hasCredential('deepiris', 'apiKey'),
    (handle: ConnectionHandle, key: string) => ctx.remote(handle).storeCredential('deepiris', 'apiKey', key),
    (handle: ConnectionHandle) => ctx.remote(handle).deleteCredential('deepiris', 'apiKey'),
  )

  ctx.forwardedEvents.on('connection/open', ({ handle }) => {
    deepiris.onConnectionOpen(handle)
  })
  ctx.forwardedEvents.on('connection/close', () => {
    deepiris.onConnectionClose()
  })

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

export default apply
