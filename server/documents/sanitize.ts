import sanitizeHtml from "sanitize-html";

// Re-exported so the other document generators import sanitize-html through
// this module. The package ships no type declarations, and importing it
// directly from several files would multiply the same pre-existing TS7016.
export { sanitizeHtml };

export const sanitize = (html: string) => {
  if (html === "null") return "";
  return sanitizeHtml(html || "", {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "br",
      "h1",
      "h2",
      "u",
      "s",
      "span",
      "em",
      "strong",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["style"],
      a: ["href", "name", "target"],
    },
    allowedStyles: {
      "*": {
        color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/, /^rgba\(/, /[a-z]+/],
        "background-color": [
          /^#(0x)?[0-9a-f]+$/i,
          /^rgb\(/,
          /^rgba\(/,
          /[a-z]+/,
        ],
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        "font-size": [/^\d+(?:px|em|%|pt)$/],
        "font-weight": [/[a-z0-9]+/],
      },
    },
  });
};
