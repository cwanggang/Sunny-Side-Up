export interface CartonCoop { name: string; code: string; me: string; members: string[]; people: Record<string, { username: string; egg: { swatch: string; pattern: string } }> }
export const CT: { mount(el: HTMLElement, g: CartonCoop): void; toggle(): Promise<boolean>; redraw(): void; isClosed(): boolean; isBusy(): boolean };
