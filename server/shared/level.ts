import * as Rect from './rect'

const pipeConfig = {
	padding: { x: 5, y: 0 },
	width: 52,
	height: 320,
}

function createPipe(x: number, y: number, flipped = false) {
	const rect = Rect.create(x, y, pipeConfig)

	return {
		x,
		y,
		flipped,
		rect,
	}
}

export const level = {
	pipes: [createPipe(500, 0, true)],
	goal: Rect.create(1000, 0, {
		padding: { x: 0, y: 0 },
		height: 2000,
		width: 100,
	}),
}
