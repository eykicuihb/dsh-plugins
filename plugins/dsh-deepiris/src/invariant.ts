/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-deepiris`.
 *
 * @module @deepseek-ai/dsh-deepiris/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-deepiris'

/** Cordis companion plugin name. */
export const name = 'deepiris-invariant'

/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this vision model-facing tool has no independent session lifecycle stream;
 * execution relations and logs are owned by ctx.tools.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
