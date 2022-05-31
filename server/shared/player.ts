import * as Rect from './rect'

const playerConfig = {
	padding: { x: 4, y: 4 },
	width: 34,
	height: 24,
}

export function rect(x: number, y: number) {
	return Rect.create(x, y, playerConfig)
}
