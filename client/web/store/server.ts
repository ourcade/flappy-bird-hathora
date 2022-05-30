import { makeAutoObservable, ObservableMap } from 'mobx'
import merge from 'lodash/merge'

import { HathoraClient } from '../../.hathora/client'
import type { HathoraConnection } from '../../.hathora/client'
import type {
	GameState,
	IInitializeRequest,
	Player as PlayerType,
	Vector2,
} from '../../../api/types'

import { Move, State, Player } from '../../../server/shared'

const TOKEN_KEY = 'hathora-token'
function storeToken(token: string) {
	localStorage.setItem(TOKEN_KEY, token)
}

function getToken() {
	return localStorage.getItem(TOKEN_KEY)
}

class Vec2 implements Vector2 {
	x = 0
	y = 0
}

class ServerPlayer implements PlayerType {
	id: string = ''
	idx = -1
	ready: boolean = false
	location = new Vec2()
	slocation = new Vec2()
	plocation = new Vec2()
	velocity = new Vec2()
	input = { space: false }
	enabled = true
	lastTimeStamp = -1
}

class ServerState {
	time: number = 0
	startTime: number = 0
	state: State = State.Empty
	players = new ObservableMap<string, ServerPlayer>()
	winner = ''

	constructor() {
		makeAutoObservable(this)
	}
}

export class ServerStore {
	private readonly client: HathoraClient
	private _token: string | null = null
	private _connection: HathoraConnection | null = null

	readonly state = new ServerState()

	private _rtt = 0
	private moves: { time: number; flap: boolean; enabled: boolean }[] = []

	get token() {
		return this._token
	}

	get user() {
		return HathoraClient.getUserFromToken(this.token)
	}

	get connection() {
		return this._connection
	}

	get localPlayer() {
		if (!this.user) {
			return null
		}

		return this.state.players.get(this.user.id)
	}

	get rtt() {
		return this._rtt
	}

	constructor() {
		this.client = new HathoraClient()

		makeAutoObservable(this)
	}

	async login() {
		let token = getToken()
		if (token) {
			this._token = token
			return
		}

		token = await this.client.loginAnonymous()
		this._token = token
		storeToken(token)
	}

	async createRoom(request: IInitializeRequest = {}) {
		const stateId = await this.client.create(this.token, request)
		return stateId
	}

	async connect(stateId: string) {
		const conn = this.client.connect(
			this._token,
			stateId,
			(update) => {
				this.updateState(update.state)
			},
			console.error
		)
		const res = await conn.joinGame({})
		if (res.type !== 'ok') {
			conn.disconnect()
			return undefined
		}

		this.setConnection(conn)
		return this.connection
	}

	action(flap = false, enabled = true) {
		const now = Date.now()
		this.connection.ping({ time: now })
		if (flap) {
			this.connection.flap({})
		}

		this.moves.push({ time: now, flap, enabled })
	}

	disconnect() {
		const id = this.connection.stateId
		this.connection.disconnect()
		this._connection = null
		window.location.href = window.location.href.replace(id, '')
	}

	private setConnection(conn: HathoraConnection) {
		this._connection = conn
	}

	private updateState(newState: GameState) {
		// NOTE: may not want to do this and just pick out what we want tracked
		// in mobx vs what is going to be queried each tick anyway
		// merge(this.state, newState)
		this.state.time = newState.time
		this.state.startTime = newState.startTime
		this.state.state = newState.state
		this.state.winner = newState.winner

		newState.players.forEach((p, idx) => {
			if (!this.state.players.has(p.id)) {
				this.state.players.set(p.id, new ServerPlayer())
			}

			const ep = this.state.players.get(p.id)
			if (ep.enabled !== p.enabled) {
				merge(ep.location, p.location)
				console.log(`${ep.enabled} !== ${p.enabled}`)
			}

			ep.id = p.id
			ep.idx = idx
			ep.ready = p.ready
			ep.enabled = p.enabled
			ep.lastTimeStamp = p.lastTimeStamp
			merge(ep.velocity, p.velocity)
			merge(ep.slocation, p.location)
			merge(ep.plocation, p.location)
			if (p.id !== this.localPlayer.id || newState.state !== State.Playing) {
				merge(ep.location, p.location)
			}

			merge(ep.input, p.input)
		})

		const p = this.state.players.get(this.user.id)
		if (!p) {
			return
		}

		// calculate RTT
		const now = Date.now()
		// NOTE: assuming packets always arrive in the
		// order it was sent aka old timestamps won't come after
		// newer timestamps
		const rtt = now - (p.lastTimeStamp || now)
		this._rtt = (this._rtt + rtt) * 0.5

		if (newState.state !== State.Playing) {
			return
		}

		// prediction
		// remove all moves (flaps) older or equal to lastTimeStamp
		while (this.moves.length > 0) {
			const move = this.moves[0]
			if (move.time > p.lastTimeStamp) {
				break
			}

			this.moves.shift()
		}

		// sim remaining moves
		for (const move of this.moves) {
			p.input.space = move.flap
			p.enabled = move.enabled

			const { x, y } = Move.playerMove(p.slocation.x, p.slocation.y, p, 1 / 60)
			p.plocation.x = x
			p.plocation.y = y

			const playerRect = Player.rect(p.plocation.x, p.plocation.y)
			const { died } = Move.collisions(playerRect)
			p.enabled = !died
			Move.end(p)
		}
	}
}
