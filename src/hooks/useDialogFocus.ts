import { useEffect, useRef, type RefObject } from 'react';

export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose?: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const container = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el => el.getClientRects().length);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const dialog = (event.target as HTMLElement)?.closest('[role="dialog"]');
      if (dialog && dialog !== container) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current?.(); }
      if (event.key === 'Tab') {
        const items = focusable(); const first = items[0]; const last = items[items.length - 1];
        if (!first) {event.preventDefault();container.focus();return;}
        if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {event.preventDefault();last.focus();}
        else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',onKeyDown);
    return () => {document.removeEventListener('keydown',onKeyDown);if(previous?.isConnected)previous.focus();};
  }, [open, ref]);
}
