import { makeAutoObservable, ObservableMap } from 'mobx'
import merge from 'lodash/merge'

import { HathoraClient } from '../../.hathora/client'
import type { HathoraConnection } from '../../.hathora/client'
import type {
	GameState,
	IInitializeRequest,
	Input,
	Player,
	Vector2,
} from '../../../api/types'

import { State } from '../../../server/shared'

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

class ServerPlayer implements Player {
	id: string = ''
	ready: boolean = false
	location = new Vec2()
	velocity = new Vec2()
	input = { space: false }
	enabled = true
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

		newState.players.forEach((p) => {
			if (!this.state.players.has(p.id)) {
				this.state.players.set(p.id, new ServerPlayer())
			}

			const ep = this.state.players.get(p.id)
			ep.ready = p.ready
			ep.enabled = p.enabled
			merge(ep.location, p.location)
			merge(ep.velocity, p.velocity)
			merge(ep.input, p.input)
		})
	}
}
