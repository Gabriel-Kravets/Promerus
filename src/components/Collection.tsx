'use client';
import {useEffect,useState} from 'react';
import {Archive,Armchair,Flame,Lamp,Layers,Sparkles,Table2,Telescope,TreePine} from 'lucide-react';
import {useInventory} from '@/store/inventory';
import {useGame} from '@/store/game';
import {stageFor,stages} from '@/lib/movement';
import {getItemDefinition,itemSprites,studyDeskSprite,type InventoryItem,type ItemType} from '@/lib/items';
import {GamePanelHeader} from './ui/GamePrimitives';
import {deskChairSide,fixtureItem,roomFixture,roomFixtures} from '@/lib/room-fixtures';
import './collection.css';

const itemIcons:Record<ItemType,typeof Table2>={desk:Table2,tree:TreePine,carpet:Layers,'botanical-desk':Table2,lantern:Lamp,armchair:Armchair,stove:Flame,telescope:Telescope};
/** Frames of /assets/garden-stages.webp (1536 x 1024), one per tree stage, matching the canvas. */
const gardenFrames=[[0,0,768,480],[768,0,768,480],[0,480,768,544],[768,480,768,544]];

const typeLabels:Record<ItemType,string>={desk:'Desk',tree:'Tree',carpet:'Carpet','botanical-desk':'Desk',lantern:'Lighting',armchair:'Chair',stove:'Stove',telescope:'Curio'};

export default function Collection({onSelect}:{onSelect:(itemId:string)=>void}){
  const {initialized,items,tutorialSeen,markTutorialSeen,placements,returnItem,theme,fixturePositions,storedFixtures,unusedDesks}=useInventory();
  const isPlaced=(item:InventoryItem)=>roomFixture(item.id)?!storedFixtures?.includes(item.id):placements.some(p=>p.itemId===item.id);
  // Starting desks are the room's own desk spots, one per person; older per-member desk grants only show once placed.
  const collectionItems=[...items.filter(item=>item.type!=='desk'||item.grantedTo===undefined||isPlaced(item)),...roomFixtures.filter(f=>!unusedDesks.includes(f.id)).map(f=>fixtureItem(f.id,theme,fixturePositions?.[f.id]?.mirrored)!)];
  const available=collectionItems.filter(item=>!isPlaced(item)).length;
  const desks=collectionItems.filter(item=>item.type==='desk'),others=collectionItems.filter(item=>item.type!=='desk');
  const stage=useGame(state=>stageFor(state.energy));
  const [showTutorial,setShowTutorial]=useState(()=>!tutorialSeen);
  // Mark seen only once the introduction is mounted, never while scheduling it.
  useEffect(()=>{
    if(initialized&&showTutorial)markTutorialSeen();
  },[initialized,showTutorial,markTutorialSeen]);

  return <div className="collection">
    <GamePanelHeader eyebrow="SHARED BY EVERYONE IN THE ROOM" title="Room collection">
      Drag a room item to move it, including the original study desks and shared garden. Hold it still for options. After you let go, press the green Place button beside it (or Flip, or X to return it).
    </GamePanelHeader>
    {!initialized?<p role="status">Opening your collection…</p>:<>
      {showTutorial&&<section className="collection-tutorial" aria-labelledby="collection-tutorial-title">
        <Sparkles size={24} aria-hidden="true"/>
        <div><h2 id="collection-tutorial-title">Your greenhouse starts here</h2>
          <p>A desk for every gardener, and the shared garden at the heart of the room. Your starting pieces are highlighted below. You start with one desk for each person in the room, and another appears when someone new joins.</p>
          <button type="button" className="secondary" onClick={()=>setShowTutorial(false)}>Got it</button>
        </div>
      </section>}
      <p className="collection-count" role="status">{collectionItems.length} {collectionItems.length===1?'item':'items'} owned · {available} available</p>
      {collectionItems.length?<ul className="collection-grid" aria-label="Owned items">
        {desks.length>0&&(()=>{
          // Desks are grouped into one card: one per gardener, no per-desk names.
          const placedDesks=desks.filter(isPlaced).length,next=desks.find(desk=>!isPlaced(desk)),label=`${desks.length} ${desks.length===1?'desk':'desks'}`;
          const themes=[...new Set(desks.map(desk=>desk.theme))],starter=showTutorial;
          const shown=next??desks[0];
          return <li key="desks" className={`collection-item${starter?' is-starter':''}`} data-item-type="desk">
            <div className="collection-item-art">
              <svg className="collection-study-desk" viewBox={`0 0 ${studyDeskSprite.frameWidth} ${studyDeskSprite.frameHeight}`} aria-hidden="true" style={{transform:deskChairSide(shown.id,!!shown.mirrored)===-1?'scaleX(-1)':undefined}}>
                <image href={studyDeskSprite.src} width={studyDeskSprite.frameWidth*2} height={studyDeskSprite.frameHeight*2}/>
              </svg>
              <span className="collection-count-badge" aria-hidden="true">×{desks.length}</span>
            </div>
            <span className="collection-type">{typeLabels.desk}</span>
            <h2>{label}</h2>
            <span className="collection-theme">{placedDesks} in room · {desks.length-placedDesks} available{themes.length===1?` · ${themes[0]} style`:''}</span>
            {starter&&<span className="collection-starter"><Sparkles size={12} aria-hidden="true"/> Starting item</span>}
            <button type="button" className="secondary collection-preview" disabled={!next} aria-label={next?'Preview a desk in the room':`All ${label} are in the room`} onClick={()=>next&&onSelect(next.id)}>{next?'Preview in room':'All in room'}</button>
          </li>;
        })()}
        {others.map(item=>{
          const definition=getItemDefinition(item.type,item.theme),Icon=itemIcons[item.type];
          const fixture=roomFixture(item.id),name=fixture?.name??definition.name;
          const placed=isPlaced(item);
          const starter=showTutorial&&item.grantedTo!==undefined,garden=item.id==='fixture:garden';
          return <li key={item.id} className={`collection-item${starter?' is-starter':''}`} data-item-id={item.id}>
            <div className="collection-item-art">{garden
              ?<svg className="collection-garden" viewBox={gardenFrames[stage].join(' ')} role="img" aria-label={`${stages[stage]} stage tree`} style={{aspectRatio:`${gardenFrames[stage][2]}/${gardenFrames[stage][3]}`,transform:item.mirrored?'scaleX(-1)':undefined}}><image href="/assets/garden-stages.webp" width="1536" height="1024"/></svg>
              :itemSprites[item.type]?<img className="collection-sprite" src={itemSprites[item.type]!.src} alt="" style={{transform:item.mirrored?'scaleX(-1)':undefined}}/>:<Icon size={40} strokeWidth={1.5} style={{transform:item.mirrored?'scaleX(-1)':undefined}} aria-hidden="true"/>}</div>
            <span className="collection-type">{typeLabels[item.type]}</span>
            <h2>{name}</h2>
            <span className="collection-theme">{garden?`${stages[stage]} stage · grows as the room learns`:`${item.theme} style`}</span>
            {starter&&<span className="collection-starter"><Sparkles size={12} aria-hidden="true"/> Starting item</span>}
            <button type="button" className="secondary collection-preview" disabled={placed} aria-label={placed?`${name} is already in the room`:`Preview ${name} in the room`} onClick={()=>onSelect(item.id)}>{placed?'In room':'Preview in room'}</button>
            {placed&&<button type="button" className="text-button collection-return" onClick={()=>returnItem(item.id)}>Return to collection</button>}
          </li>;
        })}
      </ul>:<div className="collection-empty"><Archive size={32} aria-hidden="true"/><p>Your collection is waiting for its first little treasure.</p></div>}
    </>}
  </div>;
}
