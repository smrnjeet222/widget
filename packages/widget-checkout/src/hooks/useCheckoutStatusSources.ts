'use client'
import type { Route } from '@lifi/sdk'
import { useAccount } from '@lifi/wallet-management'
import { useWidgetConfig } from '@lifi/widget/shared'
import { useMemo } from 'react'
import { useFrozenQuote } from './useFrozenQuote.js'
import { useResumeRecord } from './useResumeKey.js'

export interface CheckoutStatusSources {
  frozenRoute: Route | undefined
  recipientAddress: string | null
}

// The status API reports the solver's addresses for intent/deposit flows, and
// the deposit-address poll is too sparse to render the pending page. Both are
// recovered from the locally-known quote: the in-memory frozen quote, falling
// back to the persisted pending record so it survives a reload mid-flow.
export function useCheckoutStatusSources(): CheckoutStatusSources {
  const { accounts } = useAccount()
  const widgetConfig = useWidgetConfig()
  const { frozen } = useFrozenQuote()
  const resumeRecord = useResumeRecord()

  const frozenRoute = frozen?.route ?? resumeRecord?.frozenQuote?.route

  const recipientAddress = useMemo<string | null>(() => {
    const connected = accounts.find((a) => a.isConnected && a.address)?.address
    if (connected) {
      return connected
    }
    const configured = widgetConfig.toAddress
    if (configured) {
      return typeof configured === 'string' ? configured : configured.address
    }
    return frozenRoute?.toAddress ?? null
  }, [accounts, widgetConfig.toAddress, frozenRoute])

  return { frozenRoute, recipientAddress }
}
