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

function createPipeGap(x: number, y: number, gap: number) {
	return [createPipe(x, y, true), createPipe(x, y + pipeConfig.height + gap)]
}

export const level = {
	pipes: [
		...createPipeGap(700, -200, 200),
		...createPipeGap(900, -200, 150),
		...createPipeGap(1100, -100, 100),
		...createPipeGap(1300, -50, 120),
		...createPipeGap(1500, -300, 150),
		...createPipeGap(1750, -50, 75),
		...createPipeGap(1950, -200, 100),
		...createPipeGap(2200, 0, 130),
		...createPipeGap(2400, 0, 80),
		...createPipeGap(2600, -130, 120),
	],
	ground: Rect.create(0, 420, {
		padding: { x: 0, y: 0 },
		width: 10000,
		height: 80,
	}),
	goal: Rect.create(2800, 0, {
		padding: { x: 20, y: 0 },
		height: 2000,
		width: 100,
	}),
}
