import type {Metadata} from 'next';
import './globals.css';
import AuthGate from '@/components/AuthGate';
export const metadata:Metadata={title:'Sproutbound — A little learning, a little magic',description:'A cozy cooperative learning greenhouse. Learn something new and watch your shared magical garden grow.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AuthGate>{children}</AuthGate></body></html>;}
