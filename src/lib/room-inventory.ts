import {useGame} from '../store/game';
import {useInventory} from '../store/inventory';

// Presence slots are stable identities in this single-room prototype.
const activeMembers=(online:readonly boolean[])=>online.flatMap((present,index)=>present?[`member-${index}`]:[]);

/** Call after both stores hydrate. Returns the unsubscribe function for cleanup. */
export function listenForRoomJoins():()=>void {
  const current=useGame.getState();
  useInventory.getState().initializeRoom(activeMembers(current.online),current.settings.theme);
  return useGame.subscribe((next,previous)=>{
    if(previous.created&&!next.created){
      useInventory.getState().reset();
      useInventory.getState().initializeRoom(activeMembers(next.online),next.settings.theme);
      return;
    }
    if(next.settings.theme!==previous.settings.theme)useInventory.getState().setTheme(next.settings.theme);
    if(next.online!==previous.online){
      for(const [index,present] of next.online.entries()){
        if(present&&!previous.online[index])useInventory.getState().personJoined(`member-${index}`);
      }
    }
  });
}
