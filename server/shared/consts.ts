import { Color } from '../../api/types'

export enum State {
	Empty,
	WaitingForPlayers,
	Countdown,
	Playing,
	Finished,
}

export const GRAVITY = { x: 0, y: 350 }
export const VELOCITY = { x: 100, y: 0 }
export const COLORS = [Color.Yellow, Color.Red, Color.Purple, Color.Green]
export const COLOR_STRING = ['yellow', 'red', 'purple', 'green']

export const STEP = 1 / 60
export const DELTA = 1e3 / 60
