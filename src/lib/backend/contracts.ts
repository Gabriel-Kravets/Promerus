import {z} from 'zod';

export const avatarSchema=z.object({
 skin:z.string().regex(/^#[0-9a-f]{6}$/i),hair:z.string().regex(/^#[0-9a-f]{6}$/i),outfit:z.string().regex(/^#[0-9a-f]{6}$/i),
 style:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(4)]),cut:z.number().int().min(0).max(3),accessory:z.enum(['None','Hat','Glasses','Ribbon'])
}).strict();
export const profilePatchSchema=z.object({name:z.string().trim().min(1).max(20).optional(),avatar:avatarSchema.optional(),level:z.enum(['Beginner','Intermediate','Advanced']).optional(),goal:z.string().max(500).optional(),minutes:z.enum(['5','15','30']).optional(),interests:z.array(z.string().trim().min(1).max(80)).max(8).optional(),intro:z.enum(['seen','skipped']).optional(),onboardingComplete:z.boolean().optional()}).strict();
export const activitySchema=z.enum(['Online','Studying','Exploring','Idle','Taking a break']);
export const positionSchema=z.object({x:z.number().finite().min(-2).max(16),y:z.number().finite().min(-2).max(16),facing:z.union([z.literal(-1),z.literal(1)]),sequence:z.number().int().nonnegative(),geometryVersion:z.literal('moonlit-v2'),layoutVersion:z.number().int().nonnegative().optional(),activity:activitySchema,seat:z.number().int().min(-1).max(3).default(-1)}).strict();
export type BackendProfile={player_id:string;name:string;level:string;goal:string;minutes:string;interests:string[];onboarding_complete:boolean;intro_state:string;last_greenhouse_id:string|null};
export type Appearance={player_id:string;name:string;avatar:z.infer<typeof avatarSchema>;version:number};
export type World={id:string;name:string;owner_id:string;visibility:'private'|'public';allow_visits:boolean;energy:number;version:number;access_epoch:number;stage:number;moonlight_bloom:boolean;pet_pause_total:number;pet_pause_until:string|null;room_layout?:import('./room-layout.ts').RoomLayout|null;room_layout_version?:number};
export type RoomMember={player_id:string;name:string;avatar:Appearance['avatar'];appearance_version:number;online:boolean;activity:z.infer<typeof activitySchema>;x:number;y:number;facing:number;slot:number|null;seat:number;sequence:number};
export type WorldSnapshot={server_time:string;clockOffset:number;world:World;members:RoomMember[];contributions:{player_id:string;name:string;energy:number}[]};
export type SessionLease={id:string;greenhouse_id:string;slot:number;lease_until:string;sequence:number};
export type Bootstrap={profile:BackendProfile;appearance:Appearance};
export type PublicQuestion={id:string;kind:'multiple_choice'|'short_answer';prompt:string;options?:string[]};
export type OnlineLesson={id:string;title:string;text:string;ordinal:number;completed:boolean;questions:PublicQuestion[]};
export type OnlinePath={id:string;title:string;lessons:OnlineLesson[]};
export type GradeFeedback={correct:boolean;explanation:string;pending?:boolean};
export class BackendError extends Error {constructor(message:string,public code='backend_error',public details?:{position?:{x:number;y:number}}){super(message);this.name='BackendError';}}
