'use client';
import {useEffect,useState} from 'react';
import {useItemDrag,checkItemPreview,usePreviewAnchor} from '@/store/item-drag';
import {useInventory} from '@/store/inventory';
import {getItemDefinition} from '@/lib/items';
import {roomFixture} from '@/lib/room-fixtures';
import {ArrowLeftRight,Check,Undo2,X} from 'lucide-react';

export default function ItemPlacementControls(){
  const preview=useItemDrag(state=>state.preview);
  useInventory(state=>state.items);
  useInventory(state=>state.placements);
  useInventory(state=>state.fixturePositions);
  const anchor=usePreviewAnchor(state=>state.anchor);
  const [error,setError]=useState('');
  const [viewport,setViewport]=useState(1280);
  useEffect(()=>{const update=()=>setViewport(window.innerWidth);update();window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);},[]);
  // Enter confirms an idle preview from the keyboard.
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{const p=useItemDrag.getState().preview;
      if(event.key!=='Enter'||p?.phase!=='idle'||event.target instanceof HTMLButtonElement||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      event.preventDefault();const result=useItemDrag.getState().confirm();if(!result.valid)setError(result.message);};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);
  useEffect(()=>setError(''),[preview]);
  if(!preview||preview.phase!=='idle')return null;
  const check=checkItemPreview(),name=roomFixture(preview.item.id)?.name??getItemDefinition(preview.item.type,preview.item.theme).name;
  // Sit just above the piece; drop below it when it is near the top of the view.
  const below=!!anchor&&anchor.top<96,x=anchor?Math.min(Math.max(anchor.x,120),viewport-120):viewport/2;
  const style=anchor?{left:x,top:below?anchor.bottom+12:anchor.top-12}:undefined;
  return <section className={`item-placer${anchor?'':' is-docked'}${below?' is-below':''}`} style={style} role="toolbar" aria-label={`Place ${name}`}>
    <div className="item-placer-buttons">
      <button type="button" className="item-placer-place" disabled={!check.valid} title="Place here (Enter)" onClick={()=>{const result=useItemDrag.getState().confirm();if(!result.valid)setError(result.message);}}><Check size={16} aria-hidden="true"/>Place</button>
      <button type="button" className="item-placer-flip" aria-pressed={!!preview.item.mirrored} title="Flip to face the other way" onClick={()=>useItemDrag.getState().flip()}><ArrowLeftRight size={16} aria-hidden="true"/>Flip</button>
      {preview.originalPosition&&<button type="button" className="item-placer-cancel" title="Cancel and put it back how it was (Esc)" onClick={()=>useItemDrag.getState().cancel()}><Undo2 size={16} aria-hidden="true"/>Cancel</button>}
      <button type="button" className="quest-close item-placer-return" aria-label="Return item to collection" title="Return to collection" onClick={()=>useItemDrag.getState().returnToCollection()}><X size={16} aria-hidden="true"/></button>
    </div>
    {(error||!check.valid)&&<p role="status" className="item-placer-note">{error||(!check.valid?check.message:'')}</p>}
  </section>;
}
