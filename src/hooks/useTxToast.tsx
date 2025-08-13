import { useCallback } from 'react';
import { toast, type Id } from 'react-toastify/unstyled';
import { TOAST_AUTO_CLOSE_TIME, DEFAULT_EXPLORER_URL } from '@/lib/constants';

type TxAction = 'signing' | 'submitted' | 'success' | 'failed';

type SetTxToastOpts = {
  id?: Id;
  hash?: `0x${string}`;
  message?: string;
};

const EXPLORER_BASE_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

function txUrl(hash?: `0x${string}`) {
  return hash ? `${EXPLORER_BASE_URL}/tx/${hash}` : undefined;
}

export function useTxToast() {
  const setTxToast = useCallback(
    (action: TxAction, opts: SetTxToastOpts = {}): Id => {
      const { id, hash, message } = opts;
      const url = txUrl(hash);

      // in our flow, we always have an id for the toast, we do not have id only when signing
      if (!id && action !== 'signing') {
        return '';
      }
      const tId = id!;

      switch (action) {
        case 'signing': {
          return toast(
            <ToastBody
              text={message ?? 'Confirm this transaction in your wallet…'}
            />,
            {
              autoClose: false,
              isLoading: true,
              closeOnClick: false,
            }
          );
        }

        case 'submitted': {
          toast.update(tId, {
            render: (
              <ToastBody
                text={message ?? 'Submitted. Waiting for confirmation…'}
                url={url}
              />
            ),
            isLoading: true,
            type: 'default',
            autoClose: false,
            closeOnClick: false,
          });
          return tId;
        }

        case 'success': {
          toast.update(tId, {
            render: (
              <ToastBody
                text={message ?? 'All set! Transaction confirmed.'}
                url={url}
              />
            ),
            isLoading: false,
            type: 'success',
            autoClose: TOAST_AUTO_CLOSE_TIME,
          });
          return tId;
        }

        case 'failed': {
          toast.update(tId, {
            render: (
              <ToastBody
                text={message ?? 'Transaction failed. Please try again.'}
                url={url}
              />
            ),
            isLoading: false,
            type: 'error',
            autoClose: TOAST_AUTO_CLOSE_TIME,
          });
          return tId;
        }

        default:
          return id ?? '';
      }
    },
    []
  );

  return { setTxToast };
}

function ToastBody({ text, url }: { text: string; url?: string }) {
  return (
    <div className='flex flex-col'>
      <span>{text}</span>
      {url && (
        <a
          href={url}
          target='_blank'
          rel='noreferrer'
          className='underline'
          style={{ marginTop: 4 }}
        >
          View on explorer
        </a>
      )}
    </div>
  );
}
