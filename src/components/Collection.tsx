'use client';
import {useBackend} from './backend/BackendProvider';
import {useEffect,useState} from 'react';
import {Archive,Armchair,Flame,Lamp,Layers,Sparkles,Table2,Telescope,TreePine} from 'lucide-react';
import {useInventory} from '@/store/inventory';
import {getItemDefinition,itemSprites,type InventoryItem,type ItemType} from '@/lib/items';
import {GamePanelHeader} from './ui/GamePrimitives';
import {fixtureItem,roomFixture,roomFixtures} from '@/lib/room-fixtures';
import './collection.css';

const itemIcons:Record<ItemType,typeof Table2>={desk:Table2,tree:TreePine,carpet:Layers,'botanical-desk':Table2,lantern:Lamp,armchair:Armchair,stove:Flame,telescope:Telescope};
const typeLabels:Record<ItemType,string>={desk:'Desk',tree:'Tree',carpet:'Carpet','botanical-desk':'Desk',lantern:'Lighting',armchair:'Chair',stove:'Stove',telescope:'Curio'};

export default function Collection({onSelect}:{onSelect:(itemId:string)=>void}){
  const backend=useBackend();
  const {initialized,items,tutorialSeen,markTutorialSeen,placements,returnItem,theme,fixturePositions,storedFixtures}=useInventory();
  const collectionItems=[...items,...roomFixtures.map(f=>fixtureItem(f.id,theme,fixturePositions?.[f.id]?.mirrored)!)];
  const available=items.length-placements.length+(storedFixtures?.length??0);
  const isPlaced=(item:InventoryItem)=>roomFixture(item.id)?!storedFixtures?.includes(item.id):placements.some(p=>p.itemId===item.id);
  const desks=collectionItems.filter(item=>item.type==='desk'),others=collectionItems.filter(item=>item.type!=='desk');
  const [showTutorial,setShowTutorial]=useState(()=>!tutorialSeen);
  // Mark seen only once the introduction is mounted, never while scheduling it.
  useEffect(()=>{
    if(initialized&&showTutorial)markTutorialSeen();
  },[initialized,showTutorial,markTutorialSeen]);

  return <div className="collection">
    <GamePanelHeader eyebrow="SHARED BY EVERYONE IN THE ROOM" title="Room collection">
      Drag a room item to move it, including the original study desks and shared garden. Hold it still for options. After you let go, press the green Place button beside it (or Flip, or X to return it).
    </GamePanelHeader>
    {backend.enabled&&<p role="status">Online room layouts are read-only until shared furniture storage is connected. Your local preview collection remains saved on this device.</p>}
    {!initialized?<p role="status">Opening your collection…</p>:<>
      {showTutorial&&<section className="collection-tutorial" aria-labelledby="collection-tutorial-title">
        <Sparkles size={24} aria-hidden="true"/>
        <div><h2 id="collection-tutorial-title">Your greenhouse starts here</h2>
          <p>A desk for every gardener, and a tree to bring the room to life. Your starting pieces are highlighted below. When someone new joins, a matching desk joins your collection.</p>
          <button type="button" className="secondary" onClick={()=>setShowTutorial(false)}>Got it</button>
        </div>
      </section>}
      <p className="collection-count" role="status">{collectionItems.length} {collectionItems.length===1?'item':'items'} owned · {available} available</p>
      {collectionItems.length?<ul className="collection-grid" aria-label="Owned items">
        {desks.length>0&&(()=>{
          // Desks are grouped into one card: one per gardener, no per-desk names.
          const placedDesks=desks.filter(isPlaced).length,next=desks.find(desk=>!isPlaced(desk)),label=`${desks.length} ${desks.length===1?'desk':'desks'}`;
          const themes=[...new Set(desks.map(desk=>desk.theme))],starter=showTutorial&&desks.some(desk=>desk.grantedTo!==undefined);
          return <li key="desks" className={`collection-item${starter?' is-starter':''}`} data-item-type="desk">
            <div className={`collection-item-art collection-art-${(next??desks[0]).theme.toLowerCase()}`}><Table2 size={40} strokeWidth={1.5} aria-hidden="true"/></div>
            <span className="collection-type">{typeLabels.desk}</span>
            <h2>{label}</h2>
            <span className="collection-theme">{placedDesks} in room · {desks.length-placedDesks} available{themes.length===1?` · ${themes[0]} style`:''}</span>
            {starter&&<span className="collection-starter"><Sparkles size={12} aria-hidden="true"/> Starting item</span>}
            <button type="button" className="secondary collection-preview" disabled={!next||backend.enabled} aria-label={next?'Preview a desk in the room':`All ${label} are in the room`} onClick={()=>next&&onSelect(next.id)}>{next?'Preview in room':'All in room'}</button>
          </li>;
        })()}
        {others.map(item=>{
          const definition=getItemDefinition(item.type,item.theme),Icon=itemIcons[item.type];
          const fixture=roomFixture(item.id),name=fixture?.name??definition.name;
          const placed=isPlaced(item);
          const starter=showTutorial&&(item.id==='starter:tree'||item.grantedTo!==undefined);
          return <li key={item.id} className={`collection-item${starter?' is-starter':''}`} data-item-id={item.id}>
            <div className={`collection-item-art collection-art-${item.theme.toLowerCase()}`}>{itemSprites[item.type]?<img className="collection-sprite" src={itemSprites[item.type]!.src} alt="" style={{transform:item.mirrored?'scaleX(-1)':undefined}}/>:<Icon size={40} strokeWidth={1.5} style={{transform:item.mirrored?'scaleX(-1)':undefined}} aria-hidden="true"/>}</div>
            <span className="collection-type">{typeLabels[item.type]}</span>
            <h2>{name}</h2>
            <span className="collection-theme">{item.theme} style</span>
            {starter&&<span className="collection-starter"><Sparkles size={12} aria-hidden="true"/> Starting item</span>}
            <button type="button" className="secondary collection-preview" disabled={placed||backend.enabled} aria-label={placed?`${name} is already in the room`:`Preview ${name} in the room`} onClick={()=>onSelect(item.id)}>{placed?'In room':'Preview in room'}</button>
            {placed&&<button type="button" className="text-button collection-return" disabled={backend.enabled} onClick={()=>returnItem(item.id)}>Return to collection</button>}
          </li>;
        })}
      </ul>:<div className="collection-empty"><Archive size={32} aria-hidden="true"/><p>Your collection is waiting for its first little treasure.</p></div>}
    </>}
  </div>;
}
