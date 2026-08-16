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

  const codexMetrics: QuotaMetrics = state.metrics.get('codex') || {
    provider: 'codex',
    status: 'unauthorized',
    lastUpdated: Date.now(),
  }

  const antigravityMetrics: QuotaMetrics = state.metrics.get('antigravity') || {
    provider: 'antigravity',
    status: 'unauthorized',
    lastUpdated: Date.now(),
  }

  const grokMetrics: QuotaMetrics = state.metrics.get('grok') || {
    provider: 'grok',
    status: 'unauthorized',
    lastUpdated: Date.now(),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px 0' }}>
      {/* Top Banner Overview */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: 'var(--color-bg-subtle, #f3f4f6)',
          border: '1px solid var(--color-border, #e5e7eb)',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 600 }}>{t.tabTitle}</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>{t.tabDescription}</p>
        </div>
        <button
          onClick={() => controller.refreshAll()}
          disabled={state.isRefreshing}
          style={{
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontWeight: 600,
            cursor: state.isRefreshing ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
          }}
        >
          {state.isRefreshing ? t.refreshing : t.refreshAll}
        </button>
      </div>

      {/* Grid of 3 Subscription Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        <QuotaCard
          metrics={codexMetrics}
          title={t.codexTitle}
          description={t.codexDesc}
          isRefreshing={state.isRefreshing}
          onRefresh={() => controller.refreshProvider('codex')}
          onLogin={() => alert('Initiating OpenAI Codex PKCE OAuth flow...')}
          onDisconnect={() => controller.disconnect('codex')}
        />

        <QuotaCard
          metrics={antigravityMetrics}
          title={t.antigravityTitle}
          description={t.antigravityDesc}
          isRefreshing={state.isRefreshing}
          onRefresh={() => controller.refreshProvider('antigravity')}
          onLogin={() => alert('Initiating Google CloudCode Antigravity OAuth flow...')}
          onDisconnect={() => controller.disconnect('antigravity')}
        />

        <QuotaCard
          metrics={grokMetrics}
          title={t.grokTitle}
          description={t.grokDesc}
          isRefreshing={state.isRefreshing}
          onRefresh={() => controller.refreshProvider('grok')}
          onLogin={() => alert('Initiating xAI Grok OAuth flow...')}
          onDisconnect={() => controller.disconnect('grok')}
        />
      </div>
    </div>
  )
}
