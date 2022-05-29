export type Rectangle = {
	left: number
	right: number
	top: number
	bottom: number
}

type Config = {
	padding: { x: number; y: number }
	width: number
	height: number
}

export function create(x: number, y: number, config?: Config) {
	const { padding = { x: 0, y: 0 }, width = 100, height = 100 } = config ?? {}
	const collisionWidth = width - padding.x * 2
	const collisionHeight = height - padding.y * 2

	const left = x + padding.x
	const right = left + collisionWidth
	const top = y + padding.y
	const bottom = top + collisionHeight

	return { left, right, top, bottom }
}

export function intersects(r1: Rectangle, r2: Rectangle) {
	return !(
		r2.left > r1.right ||
		r2.right < r1.left ||
		r2.top > r1.bottom ||
		r2.bottom < r1.top
	)
}
