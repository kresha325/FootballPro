import { createElement } from 'react';

/**
 * Renders a person's name so browser/page translators skip it.
 * Google Translate honors translate="no" and class "notranslate".
 */
export default function PersonName({ children, className = '', as: Tag = 'span', ...rest }) {
  const classes = ['notranslate', className].filter(Boolean).join(' ');
  return createElement(Tag, { translate: 'no', className: classes, ...rest }, children);
}
