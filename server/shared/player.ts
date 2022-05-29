import * as Rect from './rect'

const playerConfig = {
	padding: { x: 0, y: 0 },
	width: 34,
	height: 24,
}

export function rect(x: number, y: number) {
	return Rect.create(x, y, playerConfig)
}
