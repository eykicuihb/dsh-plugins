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
              <span style={{ color: '#94a3b8' }}>授权账号 (Account):</span>
              <strong style={{ color: '#38bdf8' }}>{metrics.accountEmail || '已授权账号'}</strong>
            </div>
            {metrics.subscriptionTier && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>订阅套餐 (Plan):</span>
                <strong style={{ color: '#a78bfa' }}>{metrics.subscriptionTier}</strong>
              </div>
            )}
          </div>

          {/* Rate Limits & Request Quota Section */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#13161f',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ color: '#64748b' }}>每分钟请求限额 (RPM):</span>
              <strong style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>
                {metrics.rateLimits?.rpmLimit ? `${metrics.rateLimits.rpmLimit} req/min` : '无硬性限制'}
              </strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ color: '#64748b' }}>每分钟 Token 限额 (TPM):</span>
              <strong style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>
                {metrics.rateLimits?.tpmLimit ? `${(metrics.rateLimits.tpmLimit / 1000).toLocaleString()}k token/min` : '按订阅动态扩展'}
              </strong>
            </div>
          </div>

          {/* Model Specific Live Quota Breakdown */}
          {metrics.modelQuotas && metrics.modelQuotas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                模型实时余量 (Live Model Quotas):
              </span>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {metrics.modelQuotas.map((mq) => {
                  const pct = Math.max(0, Math.min(100, mq.remainingPercentage))
                  const barColor = pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444'
                  return (
                    <div
                      key={mq.modelId}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#13161f',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{mq.name}</span>
                        <span style={{ color: barColor, fontWeight: 600 }}>{pct}% 余量</span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '4px',
                          borderRadius: '2px',
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            backgroundColor: barColor,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      {mq.resetTime && (
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          重置时间: {new Date(mq.resetTime).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ✨ 动态模型目录与思考链已同步
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
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                }}
              >
                {isRefreshing ? '刷新中…' : '刷新额度'}
              </button>
              <button
                type="button"
                onClick={onDisconnect}
                disabled={isRefreshing}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  fontSize: '0.8rem',
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                }}
              >
                断开
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Unauthorized / Disconnected State */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            borderRadius: '8px',
            backgroundColor: '#1e2330',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            gap: '12px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>🔐</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
              未连接 OAuth 账号
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              登录后即可零 API 费用直连订阅模型并实时查看配额与思考链
            </span>
          </div>
          <button
            type="button"
            onClick={onLogin}
            disabled={isRefreshing}
            style={{
              marginTop: '4px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
            }}
          >
            {isRefreshing ? '正在启动登录…' : '🔑 OAuth 浏览器登录'}
          </button>
        </div>
      )}
    </div>
  )
}
