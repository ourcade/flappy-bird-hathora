import { autorun } from 'mobx'
import type { IReactionDisposer } from 'mobx'
import Phaser from 'phaser'

import { rootStore } from '../store'

export class GameScene extends Phaser.Scene {
	private players = new Map<string, Phaser.GameObjects.Rectangle>()
	private readyText: Phaser.GameObjects.Text

	private cursors: Phaser.Types.Input.Keyboard.CursorKeys
	private background: Phaser.GameObjects.TileSprite

	private subs: IReactionDisposer[] = []

	init() {
		this.cursors = this.input.keyboard.createCursorKeys()

		this.events.once(Phaser.Scenes.Events.DESTROY, () => {
			rootStore.server.connection?.leaveGame({})
			rootStore.server.connection?.disconnect()
		})

		this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.subs.forEach((sub) => sub())
		})
	}

	create() {
		const { width, height } = this.scale
		this.background = this.add
			.tileSprite(0, height, width, height, 'background')
			.setOrigin(0, 1)
			.setScrollFactor(0)
			.setDepth(0)

		this.readyText = this.add
			.text(width * 0.5, height * 0.5, 'Press SPACE when ready...')
			.setOrigin(0.5)
			.setDepth(0)

		this.input.keyboard.once('keydown-SPACE', () => {
			if (rootStore.server.localPlayer.ready) {
				return
			}

			this.readyText.setVisible(false)
			rootStore.server.connection.ready({})
		})

		this.subs.push(
			autorun(() => {
				const players = rootStore.server.state.players.entries()
				const localPlayer = rootStore.server.localPlayer

				for (const entry of players) {
					const id = entry[0]
					if (this.players.has(id)) {
						continue
					}

					const p = entry[1]
					const player = this.add.rectangle(
						p.location.x,
						p.location.y,
						25,
						25,
						0xff0000
					)
					this.players.set(id, player)

					if (localPlayer.id === p.id) {
						this.cameras.main.startFollow(player)
						// NOTE: width should be something else and based on whatever level is loaded
						this.cameras.main.setBounds(0, 0, 10000, this.scale.height)
					}
				}
			})
		)
	}

	update(_t: number, dt: number) {
		if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
			rootStore.server.connection.flap({})
		}

		for (const entry of rootStore.server.state.players.entries()) {
			const id = entry[0]
			const sprite = this.players.get(id)
			const p = rootStore.server.state.players.get(id)
			sprite.x = p.location.x
			sprite.y = p.location.y
		}

		this.background.tilePositionX = this.cameras.main.scrollX
	}
}
