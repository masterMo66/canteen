// An open Pages tab otherwise keeps its bundled menu until the user reloads.
export function watchForUpdates() {
  const currentEntry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src
  if (!currentEntry) return
  let checking = false

  const check = async () => {
    if (checking || document.visibilityState !== 'visible') return
    checking = true
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('_check', String(Date.now()))
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) return
      const page = new DOMParser().parseFromString(await response.text(), 'text/html')
      const src = page.querySelector('script[type="module"][src]')?.getAttribute('src')
      if (!src) return
      const nextEntry = new URL(src, response.url).href
      if (nextEntry === currentEntry) return
      const destination = new URL(window.location.href)
      // A unique URL avoids a cached index; guard against a stale CDN reload loop.
      if (destination.searchParams.get('_version') === nextEntry) return
      destination.searchParams.set('_version', nextEntry)
      window.location.replace(destination.href)
    } catch {
      // Keep the existing menu usable while offline; retry on the next check.
    } finally {
      checking = false
    }
  }

  void check()
  window.setInterval(() => void check(), 60_000)
  document.addEventListener('visibilitychange', () => void check())
  window.addEventListener('focus', () => void check())
}
