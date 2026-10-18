export default function StudyRewardIcon({kind}:{kind:'nutrients'|'coins'}) {
 return <svg className={`study-reward-icon ${kind==='nutrients'?'nutrient-icon':'coin-icon'}`} width="24" height="24" viewBox="0 0 24 24" shapeRendering="crispEdges" fill="none" aria-hidden="true">
 {kind==='nutrients'?<>
 <g fill="#f4e997"><path opacity=".18" d="M7 3h12v2h2v11h-3v3H8v-2H4V8h3z"/><path d="M3 5h1V4h1v1h1v1H5v1H4V6H3zM19 19h1v-1h1v1h1v1h-1v1h-1v-1h-1z"/></g>
 <g className="falling-reward-leaf">
 <path fill="#30351e" d="M7 6h5V5h7v5h-1v5h-2v3h-3v1H9v-1H6v-2H4v-4h1V8h2z"/>
 <path fill="#638131" d="M7 7h5V6h6v4h-1v5h-2v2h-3v1H9v-1H7v-2H5v-3h1V9h1z"/>
 <path fill="#c6d65a" d="M7 7h5V6h6v2h-5v2h-3v2H7v2H5v-2h1V9h1z"/>
 <path fill="#96ac3f" d="M12 8h5v2h-1v4h-2v2h-3v1H8v-2H7v-2h3v-2h2z"/>
 <path fill="#465e29" d="M15 10h2v5h-2v2h-3v1H9v-1H7v-2h3v1h2v-2h2z"/>
 <path fill="#203b25" d="M16 7h2v1h-2v2h-3v2h-3v2H8v2H6v3H5v2H3v-2h1v-2h2v-3h2v-2h2v-2h3V8h3z"/>
 <path fill="#e4db7b" d="M9 8h1v3H9zM12 13h3v1h-3z"/>
 <path fill="#526b2b" d="M6 10h1v1H6zM8 7h2v1H8zM15 12h1v2h-1zM10 16h2v1h-2z"/>
 <path fill="#f5e8a1" d="M7 10h1v1H7zM11 9h1v1h-1zM15 7h1v1h-1z"/>
 </g>
 </>:<>
 <path fill="#63451e" opacity=".25" d="M2 19h19v3H2z"/>
 <path fill="#51371f" d="M2 13h13v6h-2v1H4v-1H2z"/>
 <path fill="#b37b30" d="M3 14h11v4h-2v1H5v-1H3z"/>
 <path fill="#e8bb55" d="M3 14h7v3H3z"/>
 <path fill="#8c5c20" d="M5 16h1v3H5zM9 16h1v3H9zM12 15h1v3h-1z"/>
 <path fill="#f6d98b" d="M4 11h9v1h2v2h-2v1H4v-1H2v-2h2z"/>
 <path fill="#e5a532" d="M5 12h7v1h1v1H4v-1h1z"/>
 <path fill="#795027" d="M2 8h13v5h-2v1H4v-1H2z"/>
 <path fill="#d39a3f" d="M3 9h11v3h-2v1H5v-1H3z"/>
 <path fill="#f6d98b" d="M3 9h7v2H3z"/>
 <path fill="#ad7520" d="M5 10h1v3H5zM9 10h1v3H9zM12 9h1v3h-1z"/>
 <path fill="#fff0bc" d="M4 5h9v1h2v3h-2v1H4V9H2V6h2z"/>
 <path fill="#edc46a" d="M5 6h7v1h2v1h-2v1H5V8H3V7h2z"/>
 <path fill="#bc8425" d="M6 7h5v1H6z"/>
 <path fill="#51371f" d="M17 9h3v2h2v7h-1v3h-3v1h-5v-2h-2v-6h2v-3h4z"/>
 <path fill="#bd8025" d="M18 10h2v2h1v6h-1v3h-5v-2h-2v-5h2v-3h3z"/>
 <path fill="#edc46a" d="M16 10h3v2h1v6h-2v2h-4v-2h-2v-4h2v-3h2z"/>
 <path fill="#fff0bc" d="M16 10h3v1h-3v2h-2v3h-1v-2h1v-3h2z"/>
 <path fill="#d79a2c" d="M18 12h1v5h-2v2h-2v-1h-1v-3h2v-2h2z"/>
 <path fill="#9d6822" d="M17 13h1v2h-1v3h-2v-1h1v-3h1z"/>
 <path fill="#805c2d" d="M16 13h2v1h-1v2h-1v1h-1v-2h1z"/>
 <path fill="#fff0bc" d="M16 13h1v1h-1v2h-1v-1h-1v-1h2z"/>
 <path fill="#ae7d35" d="M6 6h1v1H6zM10 8h1v1h-1zM4 16h1v1H4zM18 19h1v1h-1z"/>
 <path fill="#fff4cf" d="M4 5h2v1H4zM3 6h1v1H3zM18 10h1v2h-1zM11 3h1v1h1v1h-1v1h-1V5h-1V4h1z"/>
 </>}
 </svg>;
}
