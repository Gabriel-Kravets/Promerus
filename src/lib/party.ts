import type {MemberActivity} from '@/store/game';
/** Simulated classmates who share the local demo greenhouse, in room slots 1-3. */
export const CLASSMATE_NAMES=['Maya','Kai','Jules'] as const;
export const classmateSubjects=['College Algebra','Spanish Basics','Creative Writing'] as const;
type PartyState={online:boolean[];memberActivities:MemberActivity[];localActivity:MemberActivity};
export function memberStatus(state:PartyState,index:number,panel=''):MemberActivity|'Offline'{
 if(index>0&&!state.online[index])return 'Offline';
 if(index===0){if(panel==='learn')return 'Studying';if(panel==='hearth')return 'Taking a break';return state.localActivity;}
 return state.memberActivities[index]??'Online';
}
