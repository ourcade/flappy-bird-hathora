import { autorun } from 'mobx'
import type { IReactionDisposer } from 'mobx'
import Phaser from 'phaser'

import { rootStore } from '../store'
import { level } from '../../../server/shared/level'
import { Move, Player, State } from '../../../server/shared'

const delta = 1e3 / 60
const step = 1 / 60
let accumulator = 0

export class GameScene extends Phaser.Scene {
	private players = new Map<string, Phaser.GameObjects.Rectangle>()
	private playersDebug = new Map<string, Phaser.GameObjects.Rectangle>()
	private playersPredictedDebug = new Map<
		string,
		Phaser.GameObjects.Rectangle
	>()
	private readyText: Phaser.GameObjects.Text
	private countdownText: Phaser.GameObjects.Text

	private cursors: Phaser.Types.Input.Keyboard.CursorKeys
	private background: Phaser.GameObjects.TileSprite
	private ground: Phaser.GameObjects.TileSprite

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

		const g = level.ground
		this.ground = this.add
			.tileSprite(g.left, g.top, g.right - g.left, g.bottom - g.top, 'base')
			.setOrigin(0)

		this.readyText = this.add
			.text(width * 0.5, height * 0.5, 'Press SPACE when ready...')
			.setOrigin(0.5)

		this.countdownText = this.add
			.text(width * 0.5, height * 0.5, '3', {
				fontSize: '100px',
				stroke: '#000000',
				strokeThickness: 12,
			})
			.setOrigin(0.5)
			.setVisible(false)

		this.input.keyboard.once('keydown-SPACE', () => {
			if (rootStore.server.localPlayer.ready) {
				return
			}

			this.readyText.setVisible(false)
			rootStore.server.connection.ready({})
		})

		level.pipes.forEach((pipe) => {
			const p = this.add.image(pipe.x, pipe.y, 'pipe').setOrigin(0)
			p.flipY = pipe.flipped
		})

		const goal = level.goal
		this.add.image(goal.left, goal.top, 'goal').setOrigin(0).setAlpha(0.7)

		this.handlePlayerJoins()
		this.handleStateEnter()
	}

	private handlePlayerJoins() {
		this.subs.push(
			// player joins
			autorun(() => {
				const players = rootStore.server.state.players.entries()
				const localPlayer = rootStore.server.localPlayer

				for (const entry of players) {
					const id = entry[0]
					if (this.players.has(id)) {
						continue
					}

					const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xf0f0f]
					const p = entry[1]
					const player = this.add
						.rectangle(p.location.x, p.location.y, 34, 24, colors[p.idx])
						.setOrigin(0)

					this.players.set(id, player)

					const debug = this.add
						.rectangle(p.location.x, p.location.y, 34, 24, colors[p.idx], 0.5)
						.setOrigin(0)
					this.playersDebug.set(id, debug)

					const predicted = this.add
						.rectangle(p.location.x, p.location.y, 34, 25)
						.setOrigin(0)
						.setStrokeStyle(1, 0x000000, 0.5)
						.setFillStyle()
					this.playersPredictedDebug.set(id, predicted)

					if (localPlayer.id === p.id) {
						this.cameras.main.startFollow(player)
						// NOTE: width should be something else and based on whatever level is loaded
						this.cameras.main.setBounds(0, 0, 10000, this.scale.height)
					}
				}
			})
		)
	}

	private handleStateEnter() {
		this.subs.push(
			// countdown
			autorun(() => {
				if (rootStore.server.state.state !== State.Countdown) {
					return
				}

				this.countdownText.setVisible(true)
			}),
			// playing,
			autorun(() => {
				if (rootStore.server.state.state !== State.Playing) {
					return
				}

				this.countdownText.setVisible(false)
			}),
			// winner
			autorun(() => {
				const winner = rootStore.server.state.winner
				if (!winner) {
					return
				}

				const winningPlayer = this.players.get(winner)
				if (!winningPlayer) {
					return
				}

				const cam = this.cameras.main
				cam.stopFollow()
				cam.pan(
					winningPlayer.x,
					winningPlayer.y,
					700,
					Phaser.Math.Easing.Sine.InOut
				)

				const { height } = this.scale

				const x = winningPlayer.x
				const y = winningPlayer.y > height * 0.5 ? height * 0.25 : height * 0.75
				const t = this.add
					.text(x, y, 'Winner!', {
						fontSize: '100px',
						stroke: '#000000',
						strokeThickness: 10,
					})
					.setOrigin(0.5)
				this.add
					.text(t.x, t.y + t.height * 0.5, 'Press SPACE to continue...', {
						stroke: '#000000',
						strokeThickness: 3,
					})
					.setOrigin(0.5)

				this.input.keyboard.once('keydown-SPACE', () => {
					rootStore.server.disconnect()
				})
			})
		)
	}

	fixedUpdate(dt: number) {
		const space = Phaser.Input.Keyboard.JustDown(this.cursors.space)

		switch (rootStore.server.state.state) {
			case State.Finished: {
				for (const entry of rootStore.server.state.players.entries()) {
					const id = entry[0]
					const sprite = this.players.get(id)
					const debug = this.playersDebug.get(id)
					const predicted = this.playersPredictedDebug.get(id)
					const p = rootStore.server.state.players.get(id)
					sprite.x = p.location.x
					sprite.y = p.location.y
					debug.x = p.slocation.x
					debug.y = p.slocation.y
					predicted.x = p.plocation.x
					predicted.y = p.plocation.y
				}
				break
			}

			case State.Playing: {
				for (const entry of rootStore.server.state.players.entries()) {
					const id = entry[0]
					const sprite = this.players.get(id)
					const debug = this.playersDebug.get(id)
					const predicted = this.playersPredictedDebug.get(id)
					const p = rootStore.server.state.players.get(id)

					if (p.id === rootStore.server.localPlayer.id) {
						rootStore.server.action(space, p.enabled)
						p.input.space = space
						const { x, y } = Move.playerMove(p.location.x, p.location.y, p, dt)
						p.location.x = x
						p.location.y = y
						const playerRect = Player.rect(p.location.x, p.location.y)
						const { died } = Move.collisions(playerRect)
						p.enabled = !died
						Move.end(p)
					} else {
						// dead reckoning for remote
					}

					sprite.x = p.location.x
					sprite.y = p.location.y
					debug.x = p.slocation.x
					debug.y = p.slocation.y
					predicted.x = p.plocation.x
					predicted.y = p.plocation.y
				}
			}

			case State.Countdown: {
				const diff =
					rootStore.server.state.startTime - rootStore.server.state.time
				const secs = Math.ceil(diff)
				this.countdownText.setText(`${secs}`)
				break
			}
		}

		const sx = this.cameras.main.scrollX
		this.background.tilePositionX = sx
		this.ground.tilePositionX = sx
	}

	update(_t: number, dt: number) {
		if (dt > 1e3) {
			// skip large dt's
			return
		}

		accumulator += dt

		while (accumulator >= delta) {
			this.fixedUpdate(step)
			accumulator -= delta
		}
	}
}
