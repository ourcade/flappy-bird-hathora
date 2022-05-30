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
} from '../api/types'

import { State, Move, Player } from './shared'

type InternalState = GameState

let last = performance.now()
const delta = 1e3 / 60 // / 1000
const step = 1 / 60

let frames = 0
let total = 0

export class Impl implements Methods<InternalState> {
	private accumulator = 0

	initialize(ctx: Context, request: IInitializeRequest): InternalState {
		return {
			state: State.Empty,
			time: 0,
			startTime: 0,
			players: [],
			winner: '',
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
			lastTimeStamp: 0,
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

	ping(
		state: GameState,
		userId: string,
		ctx: Context,
		request: IPingRequest
	): Response {
		const time = request.time
		const player = state.players.find((player) => player.id === userId)
		if (!player) {
			return Response.error('player not found')
		}

		player.lastTimeStamp = time
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
					player.velocity.x = 30
					player.velocity.y = 0
				})
				this.accumulator = 0
				state.state = State.Playing
				break

			case State.Playing:
				this.playTick(state, dt)
				break

			case State.Finished:
				break
		}
	}

	onTick(state: InternalState, ctx: Context, _dt: number): void {
		const timestamp = performance.now()
		const dt = timestamp - last
		last = timestamp

		total += dt
		this.accumulator += dt

		// NOTE: this is to get 60 updates per second
		// console.log(`${this.accumulator} >= ${delta}`)
		while (this.accumulator >= delta) {
			this.tick(state, step)

			++frames

			this.accumulator -= delta
		}

		if (total >= 1000) {
			for (let i = frames; i < 60; ++i) {
				this.tick(state, step)

				++frames
			}

			frames = 0
			total -= 1000
		}
	}

	playTick(state: InternalState, dt: number) {
		for (const player of state.players) {
			Move.simRespawn(player, dt)

			const { x, y } = Move.playerMove(
				player.location.x,
				player.location.y,
				player,
				dt
			)
			player.location.x = x
			player.location.y = y

			if (player.enabled) {
				const playerRect = Player.rect(player.location.x, player.location.y)
				const { goal, died } = Move.collisions(playerRect)

				if (goal) {
					state.winner = player.id
				} else if (died) {
					Move.queueRespawn(player)
				}
			}
		}

		if (state.winner) {
			state.state = State.Finished
		}

		// end of each tick
		state.players.forEach(Move.end)
	}
}
