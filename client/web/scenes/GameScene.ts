import { autorun, reaction } from 'mobx'
import type { IReactionDisposer } from 'mobx'
import Phaser from 'phaser'

import { rootStore } from '../store'
import { level } from '../../../server/shared/level'
import {
	Logic,
	Player,
	DELTA,
	STEP,
	VELOCITY,
	COLOR_STRING,
} from '../../../server/shared'
import { State } from '../../../api/types'

const delta = DELTA
const step = STEP
let accumulator = 0

export class GameScene extends Phaser.Scene {
	private players = new Map<string, Phaser.GameObjects.Sprite>()
	private playersDebug = new Map<string, Phaser.GameObjects.Rectangle>()
	private playersPredictedDebug = new Map<
		string,
		Phaser.GameObjects.Rectangle
	>()
	private readyText: Phaser.GameObjects.Text
	private countdownText: Phaser.GameObjects.Text

	private cursors: Phaser.Types.Input.Keyboard.CursorKeys
	private ground: Phaser.GameObjects.TileSprite
	private youArrow: Phaser.GameObjects.Image

	private subs: IReactionDisposer[] = []

	init() {
		this.cursors = this.input.keyboard.createCursorKeys()
		this.players.clear()
		this.playersDebug.clear()
		this.playersPredictedDebug.clear()

		const toggleDebug = () => {
			rootStore.setDebug(!rootStore.debug)
		}
		const key = 'keydown-D'
		this.input.keyboard.on(key, toggleDebug)

		let intervalId = -1
		const handleBlur = () => {
			intervalId = window.setInterval(() => {
				// still send pings (in the case the app is unfocused)
				rootStore.server.action()
			}, 500)
		}
		const handleFocus = () => {
			window.clearInterval(intervalId)
			intervalId = -1
		}

		window.addEventListener('blur', handleBlur)
		window.addEventListener('focus', handleFocus)

		this.events.once(Phaser.Scenes.Events.DESTROY, () => {
			rootStore.server.connection?.leaveGame({})
			rootStore.server.connection?.disconnect()
		})

		this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.subs.forEach((sub) => sub())
			this.input.keyboard.off(key, toggleDebug)
			window.removeEventListener('blur', handleBlur)
			window.removeEventListener('focus', handleFocus)
		})
	}

	create() {
		const { width, height } = this.scale
		this.add
			.tileSprite(0, height, width, height, 'flappy', 'background-day.png')
			.setOrigin(0, 1)
			.setScrollFactor(0)

		const goal = level.goal
		this.add
			.image(goal.left, goal.top, 'flappy', 'goal.png')
			.setOrigin(0)
			.setAlpha(0.7)

		this.readyText = this.add
			.text(width * 0.5, height * 0.6, 'Press SPACE when ready...')
			.setStroke('#000000', 4)
			.setOrigin(0.5)
			.setScrollFactor(0)

		this.countdownText = this.add
			.text(width * 0.5, height * 0.5, '3', {
				fontSize: '100px',
				stroke: '#000000',
				strokeThickness: 12,
			})
			.setOrigin(0.5)
			.setVisible(false)
			.setScrollFactor(0)

		level.pipes.forEach((pipe) => {
			const p = this.add
				.image(pipe.x, pipe.y, 'flappy', 'pipe-green.png')
				.setOrigin(0)
			p.flipY = pipe.flipped
		})

		const g = level.ground
		this.ground = this.add
			.tileSprite(
				g.left,
				g.top,
				g.right - g.left,
				g.bottom - g.top,
				'flappy',
				'base.png'
			)
			.setOrigin(0)
			.setScrollFactor(0)

		this.input.keyboard.once('keydown-SPACE', () => {
			if (rootStore.server.localPlayer.ready) {
				return
			}

			this.readyText.setVisible(false)
			rootStore.server.connection.ready({})
		})

		this.handlePlayerJoins()
		this.handleStateEnter()

		this.subs.push(
			autorun(() => {
				const { localPlayer, localClientPlayer } = rootStore.server
				if (!localClientPlayer || !localPlayer) {
					return
				}

				if (!localClientPlayer.enabled && !localPlayer.enabled) {
					this.cameras.main.shake(200, 0.02, true)
				}
			}),
			reaction(
				() => rootStore.debug,
				() => {
					this.playersDebug.forEach((rect) => {
						rect.setVisible(rootStore.debug)
					})
					this.playersPredictedDebug.forEach((rect) => {
						rect.setVisible(rootStore.debug)
					})
				}
			)
		)
	}

	private handlePlayerJoins() {
		this.subs.push(
			// player joins/leaves
			autorun(() => {
				const players = rootStore.server.state.players.entries()
				const localPlayer = rootStore.server.localPlayer

				this.readyText.visible = !localPlayer?.ready ?? false

				for (const key of this.players.keys()) {
					if (rootStore.server.state.players.has(key)) {
						continue
					}

					this.players.get(key)?.destroy()
					this.playersDebug.get(key)?.destroy()
					this.playersPredictedDebug.get(key)?.destroy()

					this.players.delete(key)
					this.playersDebug.delete(key)
					this.playersPredictedDebug.delete(key)
				}

				for (const entry of players) {
					const id = entry[0]
					if (this.players.has(id)) {
						continue
					}

					const colors = [0xf8b733, 0xff0000, 0xbf4ed6, 0x3db229]
					const p = entry[1]
					const player = this.add
						.sprite(
							p.location.x,
							p.location.y,
							'flappy',
							`${COLOR_STRING[p.color]}bird-midflap.png`
						)
						.setOrigin(0)
						.play(`${COLOR_STRING[p.color]}-idle`)

					this.players.set(id, player)

					const debug = this.add
						.rectangle(p.location.x, p.location.y, 34, 24, colors[p.color], 0.5)
						.setOrigin(0)
						.setVisible(rootStore.debug)
					this.playersDebug.set(id, debug)

					const predicted = this.add
						.rectangle(p.location.x, p.location.y, 34, 25)
						.setOrigin(0)
						.setStrokeStyle(1, 0x000000, 0.5)
						.setFillStyle()
						.setVisible(rootStore.debug)
					this.playersPredictedDebug.set(id, predicted)

					if (localPlayer.id === p.id) {
						this.cameras.main.startFollow(player, true)
						this.cameras.main.setFollowOffset(-34, 0)
						this.cameras.main.setDeadzone(50, 0)

						this.cameras.main.setBounds(-1000, 0, 10000, this.scale.height)

						this.youArrow = this.add
							.image(
								player.x + player.width * 1.25,
								player.y + player.height * 0.4,
								'you-arrow'
							)
							.setOrigin(0, 0.5)
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
				this.youArrow?.destroy()
			}),
			// playing,
			reaction(
				() => rootStore.server.state.state,
				() => {
					if (rootStore.server.state.state !== State.Playing) {
						return
					}

					this.countdownText.setVisible(false)

					rootStore.server.state.cPlayers.forEach((player) => {
						const serverPlayer = rootStore.server.state.players.get(player.id)
						player.velocity.x = VELOCITY.x
						player.velocity.y = VELOCITY.y

						player.location.x = serverPlayer.location.x
						player.location.y = serverPlayer.location.y

						const sprite = this.players.get(player.id)
						sprite.play(`${COLOR_STRING[player.color]}-fly`)
					})

					// NOTE: could potentially sim position by half RTT here
					// as the server is ahead by roughly half RTT by the time
					// we get the packet that tells us state changed to Playing

					this.time.delayedCall(1000, () => {
						this.cameras.main.setLerp(0.3, 0.5)
					})
				}
			),
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
					winningPlayer.x + 17,
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
			default:
				// this also acts as a keep alive heartbeat
				rootStore.server.action()
				break

			case State.Finished: {
				rootStore.server.action()
				for (const entry of rootStore.server.state.players.entries()) {
					const id = entry[0]
					const sprite = this.players.get(id)
					const debug = this.playersDebug.get(id)
					const predicted = this.playersPredictedDebug.get(id)

					const p = rootStore.server.state.players.get(id)
					const cp = rootStore.server.state.cPlayers.get(id)
					const pp = rootStore.server.state.pPlayers.get(id)

					sprite.x = cp.location.x
					sprite.y = cp.location.y
					debug.x = p.location.x
					debug.y = p.location.y
					predicted.x = pp.location.x
					predicted.y = pp.location.y
				}
				break
			}

			case State.Playing: {
				rootStore.server.action(space)
				for (const entry of rootStore.server.state.players.entries()) {
					const id = entry[0]
					const sprite = this.players.get(id)
					const debug = this.playersDebug.get(id)
					const predicted = this.playersPredictedDebug.get(id)

					const cp = rootStore.server.state.cPlayers.get(id)
					const isLocalPlayer = id === rootStore.server.localPlayer.id

					if (isLocalPlayer) {
						Logic.processInput(cp, { space })
					}

					const playerRect = Player.rect(cp.location.x, cp.location.y)
					const { died } = Logic.collisions(playerRect)
					cp.enabled = !died

					const { x, y } = Logic.playerMove(
						cp.location.x,
						cp.location.y,
						cp,
						dt
					)
					cp.location.x = x
					cp.location.y = y

					if (cp.enabled) {
						const playerRect = Player.rect(cp.location.x, cp.location.y)
						Logic.collisions(playerRect)
					}

					sprite.x = cp.location.x
					sprite.y = cp.location.y

					const p = rootStore.server.state.players.get(id)
					const pp = rootStore.server.state.pPlayers.get(id)

					debug.x = p.location.x
					debug.y = p.location.y
					predicted.x = pp.location.x
					predicted.y = pp.location.y
				}
			}

			case State.Countdown: {
				rootStore.server.action()
				const diff =
					rootStore.server.state.startTime - rootStore.server.state.time
				const secs = Math.ceil(diff)
				this.countdownText.setText(`${secs}`)
				break
			}
		}

		const sx = this.cameras.main.scrollX
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

		rootStore.server.replayAndPrediction()
	}
}
