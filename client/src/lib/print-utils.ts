
/**
 * Utility to print a document from a URL without opening a new tab.
 * It fetches the content with proper Authorization headers first.
 */
export async function printByUrl(url: string): Promise<void> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  const html = await response.text();
  return printHtml(html);
}

/**
 * Utility to print raw HTML content without opening a new tab.
 */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
     // Temporarily set the main document title to the HTML's title
    // so that "Save to PDF" in the browser print dialog uses it as the default filename.
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const originalTitle = document.title;
    if (titleMatch && titleMatch[1]) {
      document.title = titleMatch[1].trim();
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    let isPrinted = false;
    const triggerPrint = () => {
      if (isPrinted) return;
      isPrinted = true;

      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        document.title = originalTitle;
        resolve();
      }, 1000);
    };

    if (iframe.contentWindow) {
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(html);
      iframe.contentWindow.document.close();

      // Wait for resources (styles, images) to load if any
      iframe.onload = triggerPrint;

      // Fallback in case onload doesn't trigger
      setTimeout(triggerPrint, 2000);
    } else {
      document.body.removeChild(iframe);
      resolve();
    }
  });
}
