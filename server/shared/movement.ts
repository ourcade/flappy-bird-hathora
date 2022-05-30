import type { Player as PlayerType } from '../../api/types'
import { GRAVITY } from './consts'

import * as Player from './player'
import * as Rect from './rect'
import * as Level from './level'

const respawn = new Map<string, { accumulatedTime: number }>()

export function isRespawning(id: string) {
	return respawn.has(id)
}

export function queueRespawn(player: PlayerType) {
	player.enabled = false
	player.velocity.y = 0
	respawn.set(player.id, { accumulatedTime: 0 })
}

export function simRespawn(player: PlayerType, dt: number) {
	if (respawn.has(player.id)) {
		const rs = respawn.get(player.id)!
		rs.accumulatedTime += dt
		console.log(rs.accumulatedTime)
		if (rs.accumulatedTime >= 0.5) {
			respawn.delete(player.id)
			player.location.x -= 140
			player.location.y = 240
			player.enabled = true
		}
	}
}

export function playerMove(
	x: number,
	y: number,
	player: PlayerType,
	dt: number
) {
	if (!player.enabled) {
		return { x, y }
	}

	if (player.input.space) {
		player.velocity.y = -70
	}

	x += player.velocity.x * dt
	y += player.velocity.y * dt

	player.velocity.y = player.velocity.y + GRAVITY.y * dt

	return { x, y }
}

export function collisions(playerRect: Rect.Rectangle) {
	let died = false
	for (const pipe of Level.level.pipes) {
		if (!Rect.intersects(playerRect, pipe.rect)) {
			continue
		}
		died = true
	}

	// ground
	if (Rect.intersects(playerRect, Level.level.ground)) {
		died = true
	}

	// goal
	if (Rect.intersects(playerRect, Level.level.goal)) {
		return {
			goal: true,
		}
	}

	return {
		goal: false,
		died,
	}
}

export function end(player: PlayerType) {
	player.input.space = false
}
