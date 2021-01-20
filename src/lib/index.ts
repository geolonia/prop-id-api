import { v5 as uuidv5 } from 'uuid'

export const hash = (x: number, y: number): string => {
    const mesh_identity = `${x.toString()}/${y.toString()}`
    return uuidv5(mesh_identity, uuidv5.URL);
}