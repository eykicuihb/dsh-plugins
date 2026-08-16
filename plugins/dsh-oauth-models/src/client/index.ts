/**
 * Client entry for @eykicuihb/dsh-oauth-models
 * Registers the OAuth Quota Dashboard tab into WebUI settings slots.
 */

import React from 'react'
import { OAuthQuotaTab } from './OAuthQuotaTab.tsx'
import { QuotaController } from './quota-controller.ts'
import { en, zh } from './locales.ts'

export { OAuthQuotaTab } from './OAuthQuotaTab.tsx'
export { QuotaCard } from './QuotaCard.tsx'
export { QuotaController } from './quota-controller.ts'
export { en, zh } from './locales.ts'

export const name = 'oauth-quota'
export const inject = ['slots', 'locale']

export function apply(ctx: any): void {
  const controller = new QuotaController()

  // Register localization dictionary
  if (ctx.locale?.register) {
    ctx.effect(
      () => ctx.locale.register('settings.plugins.oauth', { zh, en }),
      'dsh-oauth-models: quota locales',
    )
  }

  // Inject the OAuth Quota Tab into settings.plugins.tab slot
  if (ctx.slots?.inject) {
    ctx.slots.inject('settings.plugins.tab', () =>
      ctx.slots.register(
        {
          name: 'settings.plugins.tab',
          id: 'oauth-quota',
          order: 25,
          label: () => (ctx.locale?.getLocale?.()?.active === 'en' ? en.tabTitle : zh.tabTitle),
          locale: 'settings.plugins.oauth',
        },
        () => React.createElement(OAuthQuotaTab, {
          controller,
          locale: ctx.locale?.getLocale?.()?.active || 'zh',
        }),
      ),
    )
  }
}

apply.inject = inject
apply.name = name

export default {
  name,
  inject,
  apply,
}
