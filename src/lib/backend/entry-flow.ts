import type {BackendProfile,SessionLease} from './contracts';
export function playerEntryStep(profile:BackendProfile|null,lease:SessionLease|null){
 if(!profile?.onboarding_complete)return 'character';
 if(profile.intro_state==='pending')return 'intro';
 return lease?'world':'greenhouses';
}
