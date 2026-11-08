export interface LiquidDrawArgs { balls?: number[][]; caps?: number[][]; cover?: number }
export interface LiquidField { size(w: number, h: number): void; draw(a: LiquidDrawArgs): void; clear(): void; gl: boolean }
export const Liquid: { create(canvas: HTMLCanvasElement): LiquidField };
