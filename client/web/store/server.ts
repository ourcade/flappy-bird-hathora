import { makeAutoObservable } from 'mobx'
import merge from 'lodash/merge'

import { HathoraClient } from '../../.hathora/client'
import type { HathoraConnection } from '../../.hathora/client'
import type { GameState, IInitializeRequest } from '../../../api/types'

const TOKEN_KEY = 'hathora-token'
function storeToken(token: string) {
	localStorage.setItem(TOKEN_KEY, token)
}

function getToken() {
	return localStorage.getItem(TOKEN_KEY)
}

export class ServerStore {
	private readonly client: HathoraClient
	private _token: string | null = null
	private _connection: HathoraConnection | null = null
	private localPlayerIndex = -1

	readonly state: GameState = { time: 0, startTime: 0, players: [], state: 0 }

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
		return this.state.players[this.localPlayerIndex]
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
				if (this.localPlayerIndex < 0) {
					const idx = this.state.players.findIndex((p) => p.id === this.user.id)
					this.setLocalPlayerIndex(idx)
				}
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

	private setConnection(conn: HathoraConnection) {
		this._connection = conn
	}

	private setLocalPlayerIndex(idx: number) {
		this.localPlayerIndex = idx
	}

	private updateState(newState: GameState) {
		merge(this.state, newState)
	}
}
