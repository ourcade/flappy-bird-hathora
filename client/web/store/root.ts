import { ServerStore } from './server'

export class RootStore {
	readonly server = new ServerStore()
}
