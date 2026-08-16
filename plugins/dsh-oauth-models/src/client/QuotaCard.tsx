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
  const isExpired = metrics.status === 'expired'

  const statusColor = isConnected ? '#10b981' : isExpired ? '#ef4444' : '#64748b'
  const statusText = isConnected ? 'CONNECTED' : isExpired ? 'EXPIRED' : 'UNAUTHORIZED'

  return (
    <div
      style={{
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '20px',
        backgroundColor: '#181b24',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
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
            backgroundColor: `${statusColor}20`,
            color: statusColor,
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: statusColor,
            }}
          />
          {statusText}
        </div>
      </div>

      {/* Connected State Content */}
      {isConnected ? (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: '#1e2330',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>账号 (Account):</span>
              <strong style={{ color: '#38bdf8' }}>{metrics.accountEmail || '已授权账号'}</strong>
            </div>
            {metrics.subscriptionTier && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>订阅 (Plan):</span>
                <strong style={{ color: '#a78bfa' }}>{metrics.subscriptionTier}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ✨ OAuth 授权已激活，模型目录实时同步中
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: 'transparent',
                  color: '#cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                }}
              >
                {isRefreshing ? '...' : '刷新'}
              </button>
              <button
                type="button"
                onClick={onDisconnect}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                退出登录
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Unauthorized State Content */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 14px',
            borderRadius: '8px',
            backgroundColor: '#1e2330',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            尚未连接 OAuth 账号。点击下方按钮通过浏览器完成官方授权登录。
          </p>
          <button
            type="button"
            onClick={onLogin}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
              transition: 'background-color 0.2s',
            }}
          >
            {isRefreshing ? '正在等待浏览器授权...' : '🔑 OAuth 浏览器登录'}
          </button>
        </div>
      )}
    </div>
  )
}
