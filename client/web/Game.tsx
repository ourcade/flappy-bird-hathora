import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { Columns, Section, Button } from 'react-bulma-components'
import { GameScene } from './scenes/GameScene'
import { PreloadScene } from './scenes/PreloadScene'
import { rootStore } from './store'

export function Game() {
	const ref = useRef()

	useEffect(() => {
		if (!ref.current) {
			return
		}

		const game = new Phaser.Game({
			type: Phaser.AUTO,
			parent: ref.current,
			width: 720,
			height: 480,
			physics: {},
			scale: {
				mode: Phaser.Scale.ScaleModes.FIT,
				expandParent: false,
				autoRound: true,
			},
		})

		game.scene.add('preload', PreloadScene)
		game.scene.add('game', GameScene)

		game.scene.start('preload')

		return () => {
			game.destroy(true)
		}
	}, [ref.current])

	const handleBack = () => {
		rootStore.server.disconnect()
	}

	return (
		<Section>
			<Columns centered vCentered>
				<Columns.Column
					size={12}
					style={{
						textAlign: 'center',
						background: '#421278',
						paddingTop: '18px',
						borderRadius: '6px',
					}}
				>
					<div
						style={{
							aspectRatio: '16 / 9',
						}}
						ref={ref}
					></div>
				</Columns.Column>
			</Columns>
			<Columns centered vCentered mt={2}>
				<Columns.Column paddingless>
					<Button onClick={handleBack}>Back</Button>
				</Columns.Column>
			</Columns>
		</Section>
	)
}
