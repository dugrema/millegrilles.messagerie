import { creerSlice, creerThunks, creerMiddleware } from './contactsRedux'

const NOM_SLICE = 'contacts'

const slice = creerSlice(NOM_SLICE)
export const { reducer } = slice
export default slice.actions
export const thunks = creerThunks(slice.actions, NOM_SLICE)

export function setup(workers) {
    return creerMiddleware(workers, slice.actions, thunks, NOM_SLICE)
}
