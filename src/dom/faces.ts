// Picks one of the prototype's drawn faces for a person, so everyone keeps the same face everywhere.
// A real profile photo replaces the drawn face (Art.setPhoto), exactly like the prototype.
import { Art, PEOPLE } from './art/art';

const KEYS = Object.keys(PEOPLE);

export function faceKeyFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return KEYS[Math.abs(h) % KEYS.length];
}

/** Returns the id to pass to Art.faceSVG / friedEgg({ face }) for this person. */
export function faceId(person: { id: string; photoUrl?: string | null }): string {
  if (person.photoUrl) {
    Art.setPhoto(person.id, person.photoUrl);
    return person.id;
  }
  return faceKeyFor(person.id);
}
