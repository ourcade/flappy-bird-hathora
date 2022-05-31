import { makeAutoObservable } from 'mobx'
import { ServerStore } from './server'

export class RootStore {
	readonly server = new ServerStore()

	private _debug = false

	get debug() {
		return this._debug
	}

	constructor() {
		makeAutoObservable(this, {
			server: false,
		})
	}

	setDebug(val: boolean) {
		this._debug = val
	}
}
