import { autorun } from 'mobx'
import Phaser from 'phaser'

import type { IReactionDisposer } from 'mobx'
import { rootStore } from '../store'

export class GameScene extends Phaser.Scene {
	private player: Phaser.GameObjects.Rectangle
	private readyText: Phaser.GameObjects.Text

	private cursors: Phaser.Types.Input.Keyboard.CursorKeys

	init() {
		this.cursors = this.input.keyboard.createCursorKeys()

		const subs: IReactionDisposer[] = []
		subs.push(
			autorun(() => {
				const localPlayer = rootStore.server.localPlayer
				if (!this.player) {
					return
				}

				this.player.x = localPlayer.location.x
				this.player.y = localPlayer.location.y
			})
		)

		this.events.once(Phaser.Scenes.Events.DESTROY, () => {
			rootStore.server.connection?.leaveGame({})
			rootStore.server.connection?.disconnect()
		})

		this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
			subs.forEach((sub) => sub())
		})
	}

	create() {
		const { width, height } = this.scale
		this.readyText = this.add
			.text(width * 0.5, height * 0.5, 'Press SPACE when ready...')
			.setOrigin(0.5)

		const localPlayer = rootStore.server.localPlayer
		this.player = this.add.rectangle(
			localPlayer?.location.x ?? 50,
			localPlayer?.location.y ?? 50,
			50,
			50,
			0xff0000
		)

		this.input.keyboard.once('keydown-SPACE', () => {
			if (rootStore.server.localPlayer.ready) {
				return
			}

			this.readyText.setVisible(false)
			rootStore.server.connection.ready({})
		})
	}

	update(_t: number, dt: number) {
		if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
			rootStore.server.connection.flap({})
		}
	}
}
