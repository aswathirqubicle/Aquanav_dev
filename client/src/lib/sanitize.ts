import sanitizeHtml from "sanitize-html";

export const sanitize = (html: string) => {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'u', 's', 'br', 'span', 'em', 'strong']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'class'],
      'a': ['href', 'name', 'target'],
    },
    allowedStyles: {
      '*': {
        'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/, /^rgba\(/, /[a-z]+/],
        'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/, /^rgba\(/, /[a-z]+/],
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
        'font-size': [/^\d+(?:px|em|%|pt)$/],
        'font-weight': [/[a-z0-9]+/],
      },
    },
  });
};
