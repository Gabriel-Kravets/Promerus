let playerScope:string|null=null;
export function setPlayerStorageScope(player:string|null){playerScope=player;}
export function scopedStorageKey(key:string){return playerScope?`${key}:player:${playerScope}`:key;}
