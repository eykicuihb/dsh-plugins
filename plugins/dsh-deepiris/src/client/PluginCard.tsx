/**
 * One plugin's card: a header naming the plugin and what its settings govern,
 * disclosing that plugin's controls in place, with the save that writes them.
 */

import { useState, type ReactNode } from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'

function clsx(...args: unknown[]): string {
  return args.filter(Boolean).join(' ')
}
import type { CardShell } from './card-form.ts'
import type { PluginsSettingsLocaleKey } from './locales.ts'
import css from './PluginCard.module.css'

/** Card chrome shared by every plugin section. */
export interface PluginCardProps {
  /** Locale reader for this section's copy. */
  t: (key: PluginsSettingsLocaleKey) => string
  /** Locale key of the plugin's name. */
  titleKey: PluginsSettingsLocaleKey
  /** Locale key of the line describing what this plugin's settings govern. */
  descriptionKey: PluginsSettingsLocaleKey
  /** The card's form state: availability, writability, and what a save would do. */
  state: CardShell
  /** Write every staged edit. */
  onSave: () => void
  /** Drop every staged edit. */
  onDiscard: () => void
  /** The plugin's controls. */
  children: ReactNode
}

const FALLBACK_LABELS: Record<string, string> = {
  deepirisTitle: 'DeepIris 视觉感知',
  deepirisDescription: '配置多 Provider VLM 视觉模型以赋予 Agent 自主视觉理解与 UI 闭环能力。',
  expand: '展开设置',
  collapse: '收起设置',
  unsaved: '未保存',
  readOnly: '本部署的设置为只读。',
  saveFailed: '保存失败，请检查填写内容。',
  discard: '放弃修改',
  save: '保存',
  saving: '保存中…',
}

/**
 * Render one plugin card.
 */
export function PluginCard(props: PluginCardProps) {
  const [open, setOpen] = useState(false)
  const { state } = props

  const translate = (key: string): string => {
    try {
      const res = props.t?.(key as PluginsSettingsLocaleKey)
      if (res && res !== key) return res
    } catch {
      // fallback
    }
    return FALLBACK_LABELS[key] || key
  }

  const title = translate(props.titleKey)
  const description = translate(props.descriptionKey)
  const blocked = !state.dirty || state.invalid || state.saving

  return (
    <li className={clsx(css.card, open && css.cardOpen)}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${translate(open ? 'collapse' : 'expand')}: ${title}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{title}</span>
          <span className={css.description}>{description}</span>
        </span>
        {state.dirty ? <span className={css.pending}>{translate('unsaved')}</span> : null}
        <IconChevronDownOutline14 className={clsx(css.chevron, open && css.chevronOpen)} />
      </button>
      {open
        ? (
          <div className={css.body}>
            {!state.writable ? <p className={css.readOnly} role="status">{translate('readOnly')}</p> : null}
            {props.children}
            <div className={css.footer}>
              {state.failed ? <p className={css.failed} role="status">{translate('saveFailed')}</p> : null}
              <button
                type="button"
                className={css.discard}
                disabled={!state.dirty || state.saving}
                onClick={props.onDiscard}
              >
                {translate('discard')}
              </button>
              <button
                type="button"
                className={css.save}
                disabled={blocked}
                onClick={props.onSave}
              >
                {translate(state.saving ? 'saving' : 'save')}
              </button>
            </div>
          </div>
        )
        : null}
    </li>
  )
}
