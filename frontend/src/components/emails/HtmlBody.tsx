'use client';

import { useState } from 'react';

const BASE_STYLE = `<style>
  html,body{margin:0;padding:0}
  body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;word-wrap:break-word}
  a{color:#08863d} img{max-width:100%;height:auto}
  blockquote{margin:0 0 .75em;padding-left:12px;border-left:2px solid #d1d5db;color:#4b5563}
  p{margin:0 0 .75em}
</style>`;

/**
 * Renders user-authored email HTML isolated in an iframe. Scripts stay disabled
 * (no allow-scripts); allow-same-origin only lets us measure the content height.
 */
export function HtmlBody({ html }: { html: string }) {
  const [height, setHeight] = useState(80);
  return (
    <iframe
      title="Email body"
      sandbox="allow-same-origin allow-popups"
      srcDoc={`<!doctype html><html><head><base target="_blank">${BASE_STYLE}</head><body>${html}</body></html>`}
      onLoad={(e) => {
        const doc = e.currentTarget.contentDocument;
        if (doc) setHeight(Math.min(doc.documentElement.scrollHeight + 4, 4000));
      }}
      style={{ height }}
      className="w-full border-0"
    />
  );
}
