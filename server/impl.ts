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
	IPingRequest,
	Color,
	Input,
	State,
} from '../api/types'

import { Logic, Player, DELTA, STEP, VELOCITY, COLORS } from './shared'

type InternalState = GameState & {
	colorsBag: Color[]
	accumulator: number
	keepAlive: Map<string, number>
	lastTimestamps: Map<string, number>
	inputs: Map<string, Input>
}

const delta = DELTA / 1000
const step = STEP

export class Impl implements Methods<InternalState> {
	initialize(ctx: Context, request: IInitializeRequest): InternalState {
		return {
			state: State.Empty,
			time: 0,
			startTime: 0,
			players: [],
			winner: '',
			colorsBag: [...COLORS],
			accumulator: 0,
			keepAlive: new Map(),
			lastTimestamps: new Map(),
			inputs: new Map(),
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
		if (idx >= 4) {
			return Response.error('maximum players joined')
		}

		state.players.push({
			id: userId,
			ready: false,
			location: { x: 180, y: 120 + idx * 30 },
			velocity: { x: 0, y: 0 },
			enabled: true,
			lastTimeStamp: 0,
			color: state.colorsBag.shift() ?? Color.Yellow,
		})

		state.state = State.WaitingForPlayers

		return Response.ok()
	}

	leaveGame(
		state: InternalState,
		userId: string,
		ctx: Context,
		request: ILeaveGameRequest
	): Response {
		const idx = state.players.findIndex((p) => p.id === userId)
		if (idx < 0) {
			return Response.error('player not found')
		}

		const p = state.players.splice(idx, 1)[0]
		console.log(`${p.id} left`)
		state.colorsBag.push(p.color)
		state.keepAlive.delete(p.id)

		return Response.ok()
	}

	ready(
		state: InternalState,
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

	ping(
		state: InternalState,
		userId: string,
		ctx: Context,
		request: IPingRequest
	): Response {
		const time = request.time

		// set this on player after update
		state.lastTimestamps.set(userId, time)

		if (!state.keepAlive.has(userId)) {
			state.keepAlive.set(userId, 0)
		}
		state.keepAlive.set(userId, performance.now())

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

		// NOTE: dropped or lost inputs/moves are not handled or mitigated here
		// which means client can show the player having moved up but
		// the server never got the input and therefore did not sim a move up
		// so the player will be corrected to server's position in the next patch update
		const input = state.inputs.get(userId) ?? { space: false }
		input.space = true
		state.inputs.set(userId, input)

		return Response.ok()
	}

	getUserState(state: InternalState, userId: UserId): GameState {
		return state
	}

	tick(state: InternalState, dt: number) {
		state.time += dt

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
					player.velocity.x = VELOCITY.x
					player.velocity.y = VELOCITY.y
				})
				state.accumulator = 0
				state.state = State.Playing
				break

			case State.Playing:
				this.playTick(state, dt)
				break

			case State.Finished:
				break
		}
	}

	onTick(state: InternalState, ctx: Context, dt: number): void {
		state.accumulator += dt

		// NOTE: this is to get 60 updates per second
		while (state.accumulator >= delta) {
			this.tick(state, step)
			state.accumulator -= delta
		}

		const now = performance.now()
		const remove: string[] = []
		for (const key of state.keepAlive.keys()) {
			const t = state.keepAlive.get(key)
			if (t && now - t > 5 * 1000) {
				// kick this player
				remove.push(key)
			}
		}

		remove.forEach((id) => {
			this.leaveGame(state, id, ctx, {})
		})
	}

	playTick(state: InternalState, dt: number) {
		// end of each tick
		for (const player of state.players) {
			Logic.simRespawn(player, dt)

			const input = state.inputs.get(player.id) ?? { space: false }
			Logic.processInput(player, input)

			const { x, y } = Logic.playerMove(
				player.location.x,
				player.location.y,
				player,
				dt
			)
			player.location.x = x
			player.location.y = y

			if (player.enabled) {
				const playerRect = Player.rect(player.location.x, player.location.y)
				const { goal, died } = Logic.collisions(playerRect)

				if (goal) {
					state.winner = player.id
				} else if (died) {
					Logic.queueRespawn(player)
				}
			}
		}

		if (state.winner) {
			state.state = State.Finished
		}

		state.players.forEach((p) => {
			p.lastTimeStamp = state.lastTimestamps.get(p.id) ?? 0
			const input = state.inputs.get(p.id)
			if (input) {
				input.space = false
				state.inputs.set(p.id, input)
			}
		})
	}
}
