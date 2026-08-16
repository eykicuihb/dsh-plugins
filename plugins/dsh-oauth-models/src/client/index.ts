/**
 * Client entry for @eykicuihb/dsh-oauth-models
 * Registers the Live OAuth Quota tab into conversation.view (next to 对话 / 轨迹)
 * and settings.plugins.tab slots.
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
      () => ctx.locale.register('oauth-quota', { zh, en }),
      'dsh-oauth-models: quota locales',
    )
  }

  if (ctx.slots?.inject) {
    // 1. Injected as a top-level tab right next to "对话" (Chat) and "轨迹" (Trajectory)
    ctx.slots.inject('conversation.view', () =>
      ctx.slots.register(
        {
          name: 'conversation.view',
          id: 'oauth-quota',
          order: 20,
          locale: 'oauth-quota',
          label: () => (ctx.locale?.getLocale?.()?.active === 'en' ? 'Live Quota' : '实时额度'),
          inject: (sessionId: any) => ({ sessionId }),
        },
        () =>
          React.createElement(
            'div',
            { style: { width: '100%', height: '100%', overflowY: 'auto', padding: '16px 24px', boxSizing: 'border-box' } },
            React.createElement(OAuthQuotaTab, {
              controller,
              locale: ctx.locale?.getLocale?.()?.active || 'zh',
            }),
          ),
      ),
    )

    // 2. Also injected into settings.plugins.tab for settings management
    ctx.slots.inject('settings.plugins.tab', () =>
      ctx.slots.register(
        {
          name: 'settings.plugins.tab',
          id: 'oauth-quota',
          order: 25,
          label: () => (ctx.locale?.getLocale?.()?.active === 'en' ? en.tabTitle : zh.tabTitle),
          locale: 'oauth-quota',
        },
        () =>
          React.createElement(OAuthQuotaTab, {
            controller,
            locale: ctx.locale?.getLocale?.()?.active || 'zh',
          }),
      ),
    )
  }
}

apply.inject = inject

export default {
  name,
  inject,
  apply,
}
