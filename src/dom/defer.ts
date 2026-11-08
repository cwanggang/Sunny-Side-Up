/**
 * Run something that unmounts a DOM component (navigating away, closing it) on the next tick.
 * The DOM component is waiting for the native side to answer its call; if the web view is torn
 * down first, React Native logs "Unable to find the 'DomWebView' view with tag …".
 */
export function afterReply(fn: () => void): void {
  setTimeout(fn, 60);
}
