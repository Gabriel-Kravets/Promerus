import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {useInventory,readRoomInventory} from '../store/inventory';
import {useItemDrag} from '../store/item-drag';
import {shopCatalog} from './shop';
import {getItemDefinition,isItemType,itemSprites} from './items';

const inventory=()=>useInventory.getState(),drag=()=>useItemDrag.getState();
afterEach(()=>{drag().cancel();inventory().reset();});

test('every shop entry has a known type, a solid footprint and a sprite on disk',()=>{
  assert.equal(shopCatalog.length,5);
  for(const entry of shopCatalog){
    assert.ok(isItemType(entry.type));assert.ok(getItemDefinition(entry.type,'Stardew').solid);
    assert.equal(entry.image,itemSprites[entry.type]?.src);
    assert.ok(existsSync(join(process.cwd(),'public',entry.image)),entry.image);
  }
  assert.equal(isItemType('toString'),false);
});

test('buying adds a distinct copy to the shared room collection that survives a reload',()=>{
  assert.equal(inventory().buyItem('lantern'),null,'nothing can be bought before the room exists');
  inventory().initializeRoom(['alex','maya'],'Stardew');
  const first=inventory().buyItem('lantern')!,second=inventory().buyItem('lantern')!;
  assert.notEqual(first.id,second.id);assert.equal(first.theme,'Stardew');
  assert.equal(inventory().items.filter(item=>item.type==='lantern').length,2);
  const saved=readRoomInventory(JSON.parse(JSON.stringify(inventory())));
  assert.deepEqual(saved?.items.filter(item=>item.type==='lantern').map(item=>item.id),[first.id,second.id]);
});

test('a bought piece can be selected from Collection, flipped and placed like any other item',()=>{
  inventory().initializeRoom(1,'Classic');
  const chair=inventory().buyItem('armchair')!,spot={x:8,y:8};
  assert.ok(drag().select(chair.id));drag().beginDrag(spot,1);drag().endDrag(1);drag().flip();
  assert.ok(drag().confirm().valid);
  assert.deepEqual(inventory().placements.find(p=>p.itemId===chair.id)?.position,spot);
  assert.equal(inventory().items.find(item=>item.id===chair.id)?.mirrored,true);
});
