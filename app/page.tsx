import Script from 'next/script';
export const dynamic = 'force-dynamic';
export default function Page() {
  const demo = process.env.APP_MODE !== 'live';
  return <main id="pool" data-mode={demo ? 'demo' : 'live'} aria-busy="true">
    <p className="mx-auto max-w-3xl p-6">Opening the pool…</p>
    <Script src="/pool.mjs" type="module" strategy="afterInteractive" />
  </main>;
}
