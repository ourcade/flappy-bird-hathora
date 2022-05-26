import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { Columns, Section } from 'react-bulma-components'
import { GameScene } from './scenes/GameScene'

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

		game.scene.add('game', GameScene)

		game.scene.start('game')

		return () => {
			game.destroy(true)
		}
	}, [ref.current])

	return (
		<Section>
			<Columns centered vCentered>
				<Columns.Column size={12} style={{ textAlign: 'center' }}>
					<div style={{ aspectRatio: '16 / 9' }} ref={ref}></div>
				</Columns.Column>
			</Columns>
		</Section>
	)
}
