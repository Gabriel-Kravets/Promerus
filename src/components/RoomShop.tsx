'use client';
import {useState} from 'react';
import {Archive,Coins,Check,ShoppingBag} from 'lucide-react';
import {getItemDefinition} from '@/lib/items';
import {shopCatalog,shopCategories,type ShopCategory} from '@/lib/shop';
import {useInventory} from '@/store/inventory';
import {useBackend} from './backend/BackendProvider';
import {useGame} from '@/store/game';
import './room-shop.css';

export default function RoomShop({onOpenCollection}:{onOpenCollection:()=>void}){
 const backend=useBackend();
 const coins=useGame(state=>state.coins||0);
 const {initialized,items,placements,theme,buyItem}=useInventory();
 const [category,setCategory]=useState<'All'|ShopCategory>('All');
 const [mine,setMine]=useState(false),[notice,setNotice]=useState('');
 const owned=(type:string)=>items.filter(item=>item.type===type);
 const ownedCount=shopCatalog.reduce((sum,entry)=>sum+owned(entry.type).length,0);
 const entries=shopCatalog.filter(entry=>(category==='All'||entry.category===category)&&(!mine||owned(entry.type).length>0));
 return <div className="room-shop"><span className="eyebrow">LITTLE FINDS, LOTS OF PERSONALITY</span><h1 id="panel-title">The little room shop</h1><p className="lead">Make the greenhouse feel like home. Everything you buy joins the room’s shared Collection.</p>
 <div className="shop-layout"><aside className="shop-preview"><h2>Shared collection</h2><p>Purchases belong to the whole room. Any member can place, move, flip or put them away from the Collection.</p>
  <div className="shop-slots">{shopCatalog.map(entry=>{const copies=owned(entry.type),inRoom=copies.filter(item=>placements.some(p=>p.itemId===item.id)).length,name=getItemDefinition(entry.type,theme).name;return <div key={entry.type}><span><small>{entry.category}</small>{name}</span><span>{copies.length?`${copies.length} owned · ${inRoom} in room`:'Not owned yet'}</span></div>;})}</div>
  <button type="button" className="secondary shop-open-collection" onClick={onOpenCollection}><Archive size={16} aria-hidden="true"/> Open Collection</button>
 </aside>
 <div className="shop-catalog"><div className="shop-mode"><button aria-pressed={!mine} onClick={()=>setMine(false)}><ShoppingBag size={16}/> Shop</button><button aria-pressed={mine} onClick={()=>setMine(true)}>Owned ({ownedCount})</button></div><p className="shop-preview-note">{backend.enabled?`${coins} gold`:'Free preview purchases · gold prices are a draft.'}</p><div className="shop-filters" role="group" aria-label="Item category">{(['All',...shopCategories] as const).map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
  <div className="shop-grid">{entries.map(entry=>{const name=getItemDefinition(entry.type,theme).name,count=owned(entry.type).length;return <article className="shop-item" key={entry.type}><div className="shop-item-art"><img src={entry.image} alt=""/>{count>0&&<span><Check size={12}/>Owned ×{count}</span>}</div><small>{entry.category}</small><h3>{name}</h3><p>{entry.description}</p><span className="shop-price"><Coins size={14}/>{entry.price} gold</span><button className="primary" disabled={!initialized||backend.enabled&&coins<entry.price} onClick={()=>{if(backend.enabled&&coins<entry.price){setNotice('Not enough gold.');return;}if(buyItem(entry.type))setNotice(backend.enabled?`${name} added to the shared Collection.`:`${name} added to the shared Collection. No gold spent. Open the Collection to place it.`);}}>{backend.enabled?(count?'Buy another':`Buy · ${entry.price} gold`):(count?'Buy another · free preview':'Buy · free preview')}</button></article>;})}</div>
  {!entries.length&&<p className="shop-empty">Nothing here yet. Find a favorite in the shop to start the room’s collection.</p>}<p className="shop-notice" role="status">{notice}</p></div></div></div>;
}
