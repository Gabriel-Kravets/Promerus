import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Sproutbound — A little learning, a little magic',description:'A cozy cooperative learning greenhouse. Learn something new and watch your shared magical garden grow.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
