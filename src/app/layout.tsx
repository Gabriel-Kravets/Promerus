import type {Metadata} from 'next';
import './globals.css';
import AuthGate from '@/components/AuthGate';
export const metadata:Metadata={title:'Sproutbound — A little learning, a little magic',description:'A cozy cooperative learning greenhouse. Learn something new and watch your shared magical garden grow.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&family=VT323&display=swap"/></head><body><AuthGate>{children}</AuthGate></body></html>;}
