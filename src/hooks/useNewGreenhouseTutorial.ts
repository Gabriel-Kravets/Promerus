'use client';
import {useEffect} from 'react';
import {useInventory} from '@/store/inventory';

/** Opens the introduction after hydration and avatar creation, when no panel is open. */
export function useNewGreenhouseTutorial(enabled:boolean,onStart:()=>void){
  const initialized=useInventory(state=>state.initialized);
  const tutorialSeen=useInventory(state=>state.tutorialSeen);
  useEffect(()=>{
    if(enabled&&initialized&&!tutorialSeen)onStart();
  },[enabled,initialized,tutorialSeen,onStart]);
}
