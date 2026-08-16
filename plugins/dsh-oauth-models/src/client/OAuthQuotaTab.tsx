import React, { useEffect, useState } from 'react'
import type { OAuthProviderType, QuotaMetrics } from '../types.ts'
import { QuotaController } from './quota-controller.ts'
import { QuotaCard } from './QuotaCard.tsx'
import { en as enCopy, zh as zhCopy } from './locales.ts'

export interface OAuthQuotaTabProps {
  controller?: QuotaController
  locale?: 'en' | 'zh'
}

export function OAuthQuotaTab({
  controller = new QuotaController(),
  locale = 'zh',
}: OAuthQuotaTabProps): React.JSX.Element {
  const t = locale === 'zh' ? zhCopy : enCopy
  const [state, setState] = useState(controller.getState())

  useEffect(() => {
    return controller.subscribe((next) => {
      setState({ ...next })
    })
  }, [controller])

  const getProviderMeta = (provider: OAuthProviderType) => {
    if (provider === 'codex') {
      return { title: t.codexTitle, desc: t.codexDesc }
    }
    if (provider === 'grok') {
      return { title: t.grokTitle, desc: t.grokDesc }
    }
    return { title: t.antigravityTitle, desc: t.antigravityDesc }
  }

  // Active providers list from backend
  const activeProviders = Array.from(state.metrics.keys())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '12px 0' }}>
      {/* Top Banner Overview */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: '#181b24',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc' }}>
            {t.tabTitle}
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            {t.tabDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={() => controller.refreshAll()}
          disabled={state.isRefreshing}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: state.isRefreshing ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
          }}
        >
          {state.isRefreshing ? t.refreshing : t.refreshAll}
        </button>
      </div>

      {/* Grid of Active Subscription Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {activeProviders.map((p) => {
          const metrics: QuotaMetrics = state.metrics.get(p) || {
            provider: p,
            status: 'unauthorized',
            lastUpdated: Date.now(),
          }
          const { title, desc } = getProviderMeta(p)

          return (
            <QuotaCard
              key={p}
              metrics={metrics}
              title={title}
              description={desc}
              isRefreshing={state.isRefreshing || state.isLoggingIn === p}
              onRefresh={() => controller.refreshProvider(p)}
              onLogin={() => controller.startLogin(p)}
              onDisconnect={() => controller.disconnect(p)}
            />
          )
        })}
      </div>
    </div>
  )
}
