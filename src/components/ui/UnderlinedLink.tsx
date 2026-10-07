import type { AnchorHTMLAttributes } from 'react';
// CSS underline adapted from Skiper UI / skiper40. Attribution in docs/UI_REFERENCIAS.md.
export function UnderlinedLink({ className = '', ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} className={'underlined-link ' + className} />;
}
