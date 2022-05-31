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
} from '../api/types'

import { State, Logic, Player, DELTA, STEP, VELOCITY, COLORS } from './shared'

type InternalState = GameState

const delta = DELTA / 1000
const step = STEP

// NOTE: for some reason class properties don't seem to
// be persisting across method calls; this is a workaround
let idCounter = 0
const state: {
	frames: number
	total: number
	colorsBag: Color[]
	accumulator: number
	keepAlive: Map<string, number>
}[] = []

function createState(id: number) {
	state[id] = {
		frames: 0,
		total: 0,
		colorsBag: [...COLORS],
		accumulator: 0,
		keepAlive: new Map<string, number>(),
	}
	return state[id]
}

function getState(id: number) {
	return state[id] ?? createState(id)
}

export class Impl implements Methods<InternalState> {
	initialize(ctx: Context, request: IInitializeRequest): InternalState {
		const id = idCounter++
		createState(id)
		return {
			id,
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
			color: getState(state.id).colorsBag.shift() ?? Color.Yellow,
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

		const p = state.players.splice(idx, 1)[0]
		console.log(`${p.id} left`)
		const s = getState(state.id)
		s.colorsBag.push(p.color)
		s.keepAlive.delete(p.id)

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
		const s = getState(state.id)
		if (!s.keepAlive.has(player.id)) {
			s.keepAlive.set(player.id, 0)
		}
		s.keepAlive.set(player.id, performance.now())

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
					player.velocity.x = VELOCITY.x
					player.velocity.y = VELOCITY.y
				})
				getState(state.id).accumulator = 0
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
		if (state.id === undefined) {
			console.log(`state.id not defined`)
			return
		}

		const s = getState(state.id)
		if (!s) {
			console.error('missing state')
			return
		}

		s.total += dt
		s.accumulator += dt

		// NOTE: this is to get 60 updates per second
		while (s.accumulator >= delta) {
			this.tick(state, step)

			++s.frames

			s.accumulator -= delta
		}

		if (s.total >= 1000) {
			// sim extra frames to get to 60 as needed
			// may not be necessary
			for (let i = s.frames; i < 60; ++i) {
				this.tick(state, step)
			}

			s.frames = 0
			s.total -= 1000
		}

		const now = performance.now()
		const remove: string[] = []
		for (const key of s.keepAlive.keys()) {
			const t = s.keepAlive.get(key)
			if (t && now - t > 5 * 1000) {
				// kick this player
				remove.push(key)
				console.log(`remove ${key}: ${(now - t) * 0.001}s`)
			}
		}

		remove.forEach((id) => {
			this.leaveGame(state, id, ctx, {})
		})
	}

	playTick(state: InternalState, dt: number) {
		for (const player of state.players) {
			Logic.simRespawn(player, 'server', dt)

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
					Logic.queueRespawn(player, 'server')
				}
			}
		}

		if (state.winner) {
			state.state = State.Finished
		}

		// end of each tick
		state.players.forEach(Logic.end)
	}
}
