export * as Level from './level'
export * as Rect from './rect'
export * as Player from './player'

export enum State {
	Empty,
	WaitingForPlayers,
	Countdown,
	Playing,
	Finished,
}

export const GRAVITY = { x: 0, y: 25 }
