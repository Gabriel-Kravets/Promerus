import type {Shape} from '../world-geometry';
// The deployed moonlit-v2 validator still reserves the previous stone-bed bounds.
// Keep main's newer art/bed geometry and reserve this additional area online so
// clients never route through space rejected by the existing staging function.
export const deployedGardenReservation:Shape={kind:'ellipse',x:660,y:380,rx:102,ry:50};
