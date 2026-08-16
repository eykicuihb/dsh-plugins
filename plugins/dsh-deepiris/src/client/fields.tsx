/**
 * Hand-written controls for DeepIris plugin configuration form.
 */

import React from 'react'

export interface FieldProps {
  id: string
  label: string
  hint: string
  text: string
  overridden: boolean
  invalid: boolean
  overriddenLabel: string
  resetLabel: string
  invalidLabel: string
  disabled: boolean
  onEdit: (text: string) => void
  onReset: () => void
}

export function ValueField(props: FieldProps & {
  numeric?: boolean
  placeholder?: string
}) {
  return (
    <div className="dsh-deepiris-field">
      <div className="dsh-deepiris-field-head">
        <label className="dsh-deepiris-label" htmlFor={props.id}>{props.label}</label>
        {props.overridden
          ? (
            <span className="dsh-deepiris-badges">
              <span className="dsh-deepiris-badge">{props.overriddenLabel}</span>
              <button
                type="button"
                className="dsh-deepiris-reset"
                disabled={props.disabled}
                onClick={props.onReset}
              >
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      <input
        id={props.id}
        className={`dsh-deepiris-input ${props.invalid ? 'dsh-deepiris-input-invalid' : ''}`}
        type="text"
        {...props.numeric === true ? { inputMode: 'numeric' as const } : {}}
        {...props.invalid ? { 'aria-invalid': true } : {}}
        value={props.text}
        placeholder={props.placeholder ?? ''}
        disabled={props.disabled}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
      <p className={props.invalid ? 'dsh-deepiris-invalid' : 'dsh-deepiris-hint'}>
        {props.invalid ? props.invalidLabel : props.hint}
      </p>
    </div>
  )
}

export function SecretField(props: Pick<FieldProps, 'id' | 'label' | 'hint' | 'text' | 'disabled' | 'onEdit'> & {
  configured: boolean
  stateLabel: string
}) {
  return (
    <div className="dsh-deepiris-field">
      <div className="dsh-deepiris-field-head">
        <label className="dsh-deepiris-label" htmlFor={props.id}>{props.label}</label>
        <span className="dsh-deepiris-badges">
          <span className={props.configured ? 'dsh-deepiris-badge' : 'dsh-deepiris-badge-muted'}>
            {props.stateLabel}
          </span>
        </span>
      </div>
      <input
        id={props.id}
        className="dsh-deepiris-input"
        type="password"
        autoComplete="off"
        value={props.text}
        disabled={props.disabled}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
      <p className="dsh-deepiris-hint">{props.hint}</p>
    </div>
  )
}
