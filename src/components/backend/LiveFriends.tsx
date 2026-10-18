'use client';
import {useBackend} from './BackendProvider';
import {PlayerPortrait,GameBadge,GamePanelHeader,ProgressMeter} from '../ui/GamePrimitives';
export default function LiveFriends(){
 const {snapshot,profile,status}=useBackend();
 const contributors=snapshot?.contributions??[];
 return <><GamePanelHeader eyebrow="GROWING TOGETHER" title="Your study circle">{snapshot?.world.name||'Choose a greenhouse to meet your circle.'}</GamePanelHeader><GameBadge>{status}</GameBadge><div className="friend-list botanical-friends">{snapshot?.members.map(member=><section className={`online-world-card ${member.online?'online':'offline'}`} key={member.player_id}><PlayerPortrait avatar={member.avatar} name={member.name} offline={!member.online}/><div><strong>{member.name}{member.player_id===profile?.player_id?' · YOU':''}</strong><small>{member.online?member.activity:'Offline'}</small></div><GameBadge muted={!member.online}>{contributors.find(c=>c.player_id===member.player_id)?.energy??0} energy</GameBadge></section>)}</div><section className="garden-unlock"><div><strong>The Moonlight Bloom</strong><p>{snapshot?.world.moonlight_bloom?'Your circle awakened a Moonlight Flower.':'Two different members each complete a verified lesson.'}</p><ProgressMeter value={contributors.length} max={2} label="Verified contributors"/></div></section><p className="fineprint">Presence follows authenticated sessions. Visitors can explore but do not contribute rewards to a visited greenhouse.</p></>;
}
