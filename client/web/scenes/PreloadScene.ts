import Phaser from 'phaser'
import { rootStore } from '../store'

export class PreloadScene extends Phaser.Scene {
	preload() {
		this.load.image('background', 'assets/background-day.png')
		this.load.image('pipe', 'assets/pipe-green.png')
	}

	update(): void {
		if (rootStore.server.state.time <= 0) {
			return
		}

		this.scene.start('game')
	}
}
