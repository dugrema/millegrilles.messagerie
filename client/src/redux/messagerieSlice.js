import { creerSlice, creerThunks, creerMiddleware } from './messagerieRedux'

const NOM_SLICE = 'messagerie'

const slice = creerSlice(NOM_SLICE)
export const { reducer } = slice
export default slice.actions
export const thunks = creerThunks(slice.actions, NOM_SLICE)

export function setup(workers) {
    console.debug("setup -- slice ", slice)
    return creerMiddleware(workers, slice.actions, thunks, NOM_SLICE)
}