import Phaser from 'phaser'
import { COLOR_STRING } from '../../../server/shared'
import { rootStore } from '../store'

export class PreloadScene extends Phaser.Scene {
	preload() {
		this.load.atlas('flappy', 'assets/flappy.png', 'assets/flappy.json')
		this.load.image('you-arrow', 'assets/you-arrow.png')
	}

	create() {
		COLOR_STRING.forEach((color) => {
			this.anims.create({
				key: `${color}-fly`,
				frames: [
					{ key: 'flappy', frame: `${color}bird-upflap.png` },
					{ key: 'flappy', frame: `${color}bird-midflap.png` },
					{ key: 'flappy', frame: `${color}bird-downflap.png` },
				],
				repeat: -1,
				frameRate: 10,
			})
			this.anims.create({
				key: `${color}-idle`,
				frames: [{ key: 'flappy', frame: `${color}bird-midflap.png` }],
				repeat: -1,
				frameRate: 10,
			})
		})
	}

	update(): void {
		if (rootStore.server.state.time <= 0) {
			return
		}

		this.scene.start('game')
	}
}
