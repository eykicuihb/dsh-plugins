import React from 'react'
import type { QuotaMetrics } from '../types.ts'

export interface QuotaCardProps {
  metrics: QuotaMetrics
  title: string
  description: string
  isRefreshing?: boolean
  onRefresh: () => void
  onLogin: () => void
  onDisconnect: () => void
}

export function QuotaCard({
  metrics,
  title,
  description,
  isRefreshing = false,
  onRefresh,
  onLogin,
  onDisconnect,
}: QuotaCardProps): React.JSX.Element {
  const isConnected = metrics.status === 'connected'
  const isUnauthorized = metrics.status === 'unauthorized'

  // Calculate percentage of requests remaining
  const reqLimit = metrics.requestsLimit || 100
  const reqRemaining = metrics.requestsRemaining !== undefined ? metrics.requestsRemaining : 0
  const reqPercent = Math.min(100, Math.max(0, Math.round((reqRemaining / reqLimit) * 100)))

  // Calculate percentage of tokens remaining
  const tokLimit = metrics.tokensLimit || 1000000
  const tokRemaining = metrics.tokensRemaining !== undefined ? metrics.tokensRemaining : 0
  const tokPercent = Math.min(100, Math.max(0, Math.round((tokRemaining / tokLimit) * 100)))

  const statusColor =
    metrics.status === 'connected'
      ? '#10b981'
      : metrics.status === 'refreshing'
      ? '#f59e0b'
      : metrics.status === 'expired'
      ? '#ef4444'
      : '#6b7280'

  return (
    <div
      style={{
        border: '1px solid var(--color-border, #e5e7eb)',
        borderRadius: '12px',
        padding: '20px',
        backgroundColor: 'var(--color-bg-card, #ffffff)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header with Title & Status Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary, #6b7280)' }}>
            {description}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            backgroundColor: `${statusColor}15`,
            color: statusColor,
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: statusColor,
            }}
          />
          {metrics.status.toUpperCase()}
        </div>
      </div>

      {/* Account Details */}
      {isConnected && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-subtle, #f9fafb)',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <span style={{ color: '#6b7280' }}>Account: </span>
            <strong>{metrics.accountEmail || 'Authenticated User'}</strong>
          </div>
          <div>
            <span style={{ color: '#6b7280' }}>Plan: </span>
            <strong>{metrics.subscriptionTier || 'Standard Subscription'}</strong>
          </div>
        </div>
      )}

      {/* Metrics & Progress Bars */}
      {isConnected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Requests Remaining Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span>Requests Remaining</span>
              <span>
                <strong>{reqRemaining}</strong> / {reqLimit} ({reqPercent}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${reqPercent}%`,
                  height: '100%',
                  backgroundColor: reqPercent > 20 ? '#3b82f6' : '#ef4444',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Tokens Remaining Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span>Available Tokens</span>
              <span>
                <strong>{tokRemaining.toLocaleString()}</strong> / {tokLimit.toLocaleString()} ({tokPercent}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${tokPercent}%`,
                  height: '100%',
                  backgroundColor: '#10b981',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Rate Limits & Auto-renew meta */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8rem',
              color: '#6b7280',
              marginTop: '4px',
            }}
          >
            <span>✨ Auto-silent renewal active</span>
            {metrics.requestsResetSeconds && (
              <span>Reset in: {Math.round(metrics.requestsResetSeconds / 60)} mins</span>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            color: '#6b7280',
            fontSize: '0.9rem',
          }}
        >
          {isUnauthorized
            ? 'No OAuth credentials configured. Click Login to connect your account.'
            : 'Token expired or invalid. Please re-authenticate.'}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        {isConnected ? (
          <>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh Quota'}
            </button>
            <button
              onClick={onDisconnect}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #fee2e2',
                backgroundColor: '#fef2f2',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <button
            onClick={onLogin}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            Authenticate / Login
          </button>
        )}
      </div>
    </div>
  )
}
