/**
 * The DeepIris vision perception plugin card for WebUI Settings.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-plugins/client/DeepIrisCard
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SecretField, ValueField } from './fields.tsx'
import { PluginCard } from './PluginCard.tsx'
import type { DeepIrisCardFace } from './deepiris-card-controller.ts'
import type {} from './slot-contract.ts'

/** Props the renderer binds for the DeepIris card. */
export type DeepIrisCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<DeepIrisCardFace>

/**
 * Render the DeepIris vision card.
 */
export function DeepIrisCard(props: DeepIrisCardProps) {
  const { t } = props
  const state = props.useDeepIrisCard(snapshot => snapshot)
  const disabled = !state.writable

  return (
    <PluginCard
      t={t}
      titleKey="deepirisTitle"
      descriptionKey="deepirisDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <ValueField
        id="plugin-config-deepiris-provider"
        label={t('deepirisProvider')}
        hint={t('deepirisProviderHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.provider}
        onEdit={(text) => { props.edit('provider', text) }}
        onReset={() => { props.resetField('provider') }}
      />
      <ValueField
        id="plugin-config-deepiris-model"
        label={t('deepirisModel')}
        hint={t('deepirisModelHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.model}
        onEdit={(text) => { props.edit('model', text) }}
        onReset={() => { props.resetField('model') }}
      />
      <SecretField
        id="plugin-config-deepiris-key"
        label={t('deepirisApiKey')}
        hint={t('deepirisApiKeyHint')}
        disabled={!state.apiKeyWritable}
        text={state.apiKey.text}
        configured={state.apiKeyConfigured}
        stateLabel={state.apiKeyConfigured ? t('deepirisApiKeySet') : t('deepirisApiKeyUnset')}
        onEdit={(text) => { props.edit('apiKey', text) }}
      />
      <ValueField
        id="plugin-config-deepiris-base-url"
        label={t('deepirisBaseUrl')}
        hint={t('deepirisBaseUrlHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.baseURL}
        onEdit={(text) => { props.edit('baseURL', text) }}
        onReset={() => { props.resetField('baseURL') }}
      />
      <ValueField
        id="plugin-config-deepiris-timeout"
        label={t('deepirisTimeoutMs')}
        hint={t('deepirisTimeoutMsHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        numeric
        disabled={disabled}
        {...state.timeoutMs}
        onEdit={(text) => { props.edit('timeoutMs', text) }}
        onReset={() => { props.resetField('timeoutMs') }}
      />
    </PluginCard>
  )
}
