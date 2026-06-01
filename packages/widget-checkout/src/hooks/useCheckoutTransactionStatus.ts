import type { StatusResponse } from '@lifi/sdk'
import { getStatus } from '@lifi/sdk'
import { useSDKClient } from '@lifi/widget/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { getDepositAddressStatus } from '../utils/depositAddressStatus.js'
import {
  computeBackoffInterval,
  depositAddressQueryKey,
  txHashQueryKey,
} from '../utils/statusPolling.js'

export type CheckoutTransactionPhase = 'pending' | 'done' | 'failed'

export interface CheckoutTransactionStatus {
  status: StatusResponse | undefined
  phase: CheckoutTransactionPhase | undefined
  isLoading: boolean
  notFound: boolean
}

export interface UseCheckoutTransactionStatusArgs {
  transactionHash?: string | null
  depositAddress?: string | null
  fromChain?: number | null
}

export const useCheckoutTransactionStatus = ({
  transactionHash,
  depositAddress,
  fromChain,
}: UseCheckoutTransactionStatusArgs): CheckoutTransactionStatus => {
  const sdkClient = useSDKClient()
  const canPollByDeposit = !!depositAddress && !!fromChain
  const canPollByHash = !!transactionHash

  // Same key as the QR-page poll when we're polling by deposit address —
  // react-query shares the cache entry so the handoff is instant.
  const queryKey = canPollByHash
    ? txHashQueryKey(transactionHash)
    : depositAddressQueryKey(depositAddress, fromChain)

  const startMsRef = useRef(Date.now())

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (canPollByHash) {
        return getStatus(sdkClient, { txHash: transactionHash! }, { signal })
      }
      if (canPollByDeposit) {
        return getDepositAddressStatus({
          sdkClient,
          depositAddress: depositAddress!,
          fromChain: fromChain!,
          signal,
        })
      }
      return undefined
    },
    enabled: canPollByHash || canPollByDeposit,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'DONE' || status === 'FAILED' || status === 'INVALID') {
        return false
      }
      return computeBackoffInterval(startMsRef.current)
    },
  })

  // `NOT_FOUND` from the deposit-address path means the deposit hasn't
  // landed yet — surface it as "no status yet" so the caller keeps the
  // watching screen up instead of flipping to executing.
  const resolvedStatus = data && data.status !== 'NOT_FOUND' ? data : undefined

  const phase: CheckoutTransactionPhase | undefined = resolvedStatus
    ? resolvedStatus.status === 'DONE'
      ? 'done'
      : resolvedStatus.status === 'FAILED' ||
          resolvedStatus.status === 'INVALID'
        ? 'failed'
        : 'pending'
    : undefined

  const notFound = data?.status === 'NOT_FOUND'

  return { status: resolvedStatus, phase, isLoading, notFound }
}
