// Build the srcdoc for the sandboxed preview iframe (DEVELOPMENT.md Phase 5, RULES.md §7).
//
// The iframe runs with sandbox="allow-scripts" only (never allow-same-origin), so template
// scripts get an opaque origin and can't reach the app's cookies or session. A tiny bridge
// script reports runtime errors and the document height to the parent with postMessage.

export const PREVIEW_MESSAGE_SOURCE = "template-diary-preview";

export type PreviewMessage =
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: "error"; message: string }
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: "height"; height: number };

/** Runs before any template script. Kept small and dependency-free. */
const BRIDGE = `(function(){var S=${JSON.stringify(PREVIEW_MESSAGE_SOURCE)};function post(m){try{m.source=S;parent.postMessage(m,"*")}catch(e){}}
window.addEventListener("error",function(e){post({type:"error",message:String(e.message||"Script error")+(e.lineno?" (line "+e.lineno+")":"")})});
window.addEventListener("unhandledrejection",function(e){var r=e.reason;post({type:"error",message:"Unhandled promise rejection: "+String(r&&r.message||r)})});
var last=0;function h(){var d=document.documentElement,b=document.body;var v=Math.max(d?d.scrollHeight:0,b?b.scrollHeight:0);if(v!==last){last=v;post({type:"height",height:v})}}
window.addEventListener("load",h);document.addEventListener("DOMContentLoaded",function(){h();try{new ResizeObserver(h).observe(document.documentElement)}catch(e){setInterval(h,500)}});})();`;

/** "</script" inside the bridge would end the tag early; it never contains one, but guard anyway. */
const BRIDGE_TAG = `<script>${BRIDGE.replace(/<\/script/gi, "<\\/script")}</script>`;

/** Does the content start (after whitespace and comments) with a doctype or <html>? */
export function isFullDocument(html: string): boolean {
  const start = html
    .replace(/^(\s|<!--[\s\S]*?-->)*/, "")
    .slice(0, 20)
    .toLowerCase();
  return start.startsWith("<!doctype") || start.startsWith("<html");
}

export function buildSrcdoc(content: string): string {
  if (!isFullDocument(content)) {
    return (
      '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      `${BRIDGE_TAG}</head><body>${content}</body></html>`
    );
  }
  // Full document: put the bridge right after <head …>, or after <html …> when there is no head.
  const head = /<head(\s[^>]*)?>/i.exec(content);
  if (head) {
    const at = head.index + head[0].length;
    return content.slice(0, at) + BRIDGE_TAG + content.slice(at);
  }
  const html = /<html(\s[^>]*)?>/i.exec(content);
  if (html) {
    const at = html.index + html[0].length;
    return `${content.slice(0, at)}<head>${BRIDGE_TAG}</head>${content.slice(at)}`;
  }
  // Keep the doctype first so the page doesn't fall into quirks mode.
  const doctype = /<!doctype[^>]*>/i.exec(content);
  if (doctype) {
    const at = doctype.index + doctype[0].length;
    return content.slice(0, at) + BRIDGE_TAG + content.slice(at);
  }
  return BRIDGE_TAG + content;
}

/** Narrow an untrusted postMessage payload to a PreviewMessage (RULES.md §7). */
export function parsePreviewMessage(data: unknown): PreviewMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.source !== PREVIEW_MESSAGE_SOURCE) return null;
  if (d.type === "error" && typeof d.message === "string") {
    return { source: PREVIEW_MESSAGE_SOURCE, type: "error", message: d.message.slice(0, 500) };
  }
  if (d.type === "height" && typeof d.height === "number" && Number.isFinite(d.height)) {
    return {
      source: PREVIEW_MESSAGE_SOURCE,
      type: "height",
      height: Math.min(Math.max(0, d.height), 50_000),
    };
  }
  return null;
}
