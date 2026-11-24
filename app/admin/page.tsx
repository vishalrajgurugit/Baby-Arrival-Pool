import Script from 'next/script';
export default function Admin() {
  return <main id="admin" className="mx-auto max-w-5xl px-4 py-8">
    <h1>Organizer dashboard</h1>
    <section className="card" id="admin-content" aria-live="polite">Opening dashboard…</section>
    <Script src="/admin.mjs" type="module" strategy="afterInteractive" />
  </main>;
}
