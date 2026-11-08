// Every prop change on a DOM component calls the native view's async `injectJavaScript`, and Expo drops
// the promise it returns. If the screen goes away while that call is on its way (navigating back while
// data arrives), iOS rejects with "Unable to find the 'DomWebView' view with tag ..." and nothing catches
// it, so it surfaces as a red error even though nothing is wrong: the view is gone, so there is nothing
// left to update. This catches exactly that rejection. Import it first, before any DOM component loads.
import { requireNativeModule } from 'expo-modules-core';

type Prototype = { injectJavaScript?: (this: unknown, script: string) => unknown };

try {
  const proto = requireNativeModule<{ ViewPrototypes?: Record<string, Prototype> }>('ExpoDomWebViewModule').ViewPrototypes?.ExpoDomWebViewModule;
  const original = proto?.injectJavaScript;
  if (proto && original) {
    proto.injectJavaScript = function injectJavaScript(script: string) {
      const result = original.call(this, script);
      if (result instanceof Promise) {
        return result.catch((e: unknown) => {
          if (!String(e).includes('Unable to find')) throw e;
        });
      }
      return result;
    };
  }
} catch {
  // Not on a build with this module (web, tests): nothing to guard.
}
