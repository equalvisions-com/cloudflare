export function getBrowserInfo() {
  if (typeof navigator === "undefined") return { isIOS: false, isSafari: false, isChromeIOS: false };

  const ua = navigator.userAgent;

  const isIOS = /iP(hone|od|ad)/.test(ua);
  const isWebkit = /WebKit/.test(ua) && !/CriOS/.test(ua);
  const isSafari = isIOS && isWebkit;
  const isChromeIOS = /CriOS/.test(ua);

  return { isIOS, isSafari, isChromeIOS };
} 