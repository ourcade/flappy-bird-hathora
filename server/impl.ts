import { Methods, Context } from './.hathora/methods'
import { Response } from '../api/base'
import {
	GameState,
	UserId,
	IInitializeRequest,
	IJoinGameRequest,
	IFlapRequest,
	IReadyRequest,
	ILeaveGameRequest,
} from '../api/types'

import * as Level from './shared/level'
import * as Rect from './shared/rect'
import * as Player from './shared/player'

type InternalState = GameState

enum State {
	Empty,
	WaitingForPlayers,
	Countdown,
	Playing,
}

const GRAVITY = { x: 0, y: 20 }

export class Impl implements Methods<InternalState> {
	initialize(ctx: Context, request: IInitializeRequest): InternalState {
		return {
			state: State.Empty,
			time: 0,
			startTime: 0,
			players: [],
		}
	}

	joinGame(
		state: InternalState,
		userId: UserId,
		ctx: Context,
		request: IJoinGameRequest
	): Response {
		if (state.state === State.Playing) {
			return Response.error('cannot join a game that already started')
		}

		const existingPlayer = state.players.find((p) => p.id === userId)
		if (existingPlayer) {
			// TODO: any logic if you rejoined?
			return Response.ok()
		}

		const idx = state.players.length
		state.players.push({
			id: userId,
			ready: false,
			location: { x: 180, y: 120 + idx * 30 },
			velocity: { x: 0, y: 0 },
			input: { space: false },
			enabled: true,
		})

		state.state = State.WaitingForPlayers

		return Response.ok()
	}

	leaveGame(
		state: GameState,
		userId: string,
		ctx: Context,
		request: ILeaveGameRequest
	): Response {
		const idx = state.players.findIndex((p) => p.id === userId)
		if (idx < 0) {
			return Response.error('player not found')
		}

		state.players.splice(idx, 1)
		return Response.ok()
	}

	ready(
		state: GameState,
		userId: string,
		ctx: Context,
		request: IReadyRequest
	): Response {
		const player = state.players.find((player) => player.id === userId)
		if (!player) {
			return Response.error('player not found')
		}
		player.ready = true
		return Response.ok()
	}

	flap(
		state: InternalState,
		userId: UserId,
		ctx: Context,
		request: IFlapRequest
	): Response {
		if (state.state !== State.Playing) {
			return Response.error('not in playing state')
		}

		const player = state.players.find((player) => player.id === userId)
		if (!player) {
			return Response.error('player not found')
		}
		player.input.space = true
		return Response.ok()
	}

	getUserState(state: InternalState, userId: UserId): GameState {
		return state
	}

	onTick(state: InternalState, ctx: Context, timeDelta: number): void {
		state.time += timeDelta

		switch (state.state) {
			default:
				break

			case State.WaitingForPlayers:
				if (state.players.length <= 0) {
					break
				}

				if (!!state.players.find((p) => !p.ready)) {
					break
				}

				state.state = State.Countdown
				// start in 3s
				state.startTime = state.time + 3
				break

			case State.Countdown:
				if (state.time < state.startTime) {
					break
				}

				state.players.forEach((player) => {
					player.velocity.x = 50
					player.velocity.y = 0
				})
				state.state = State.Playing
				break

			case State.Playing:
				this.playTick(state, timeDelta)
				break
		}
	}

	// NOTE: this logic here will need to be shared by client
	playTick(state: InternalState, timeDelta: number) {
		// set velocity
		state.players.forEach((player) => {
			if (player.input.space) {
				player.velocity.y = -50
			}
		})

		state.players.forEach((player) => {
			if (!player.enabled) {
				return
			}

			// movement
			player.location.x += player.velocity.x * timeDelta
			player.location.y += player.velocity.y * timeDelta

			// gravity
			player.velocity.y = Math.min(
				player.velocity.y + GRAVITY.y * timeDelta,
				50
			)

			// collisions
			const playerRect = Player.rect(player.location.x, player.location.y)
			for (const pipe of Level.level.pipes) {
				if (!Rect.intersects(playerRect, pipe.rect)) {
					continue
				}
				player.enabled = false
				setTimeout(() => {
					player.location.x -= 100
					player.location.y = 240
					player.enabled = true
				}, 500)
			}
		})

		// set space input to false at the end of each tick
		state.players.forEach((player) => {
			player.input.space = false
		})
	}
}
