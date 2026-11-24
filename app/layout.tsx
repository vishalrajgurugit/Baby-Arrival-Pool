import type { ReactNode } from 'react';
import './tailwind.css';
export const metadata = {title:'Mahuvagara Baby Arrival Pool 2027', description:'Guess the day our newest family member arrives.'};
export default function Layout({children}: {children: ReactNode}) {
  return <html lang="en-CA"><head><link rel="stylesheet" href="/pool.css" /></head><body className="antialiased">{children}</body></html>;
}
