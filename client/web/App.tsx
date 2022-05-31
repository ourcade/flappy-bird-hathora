import React, { useEffect, useState } from 'react'
import {
	Box,
	Button,
	Columns,
	Container,
	Form,
	Progress,
	Section,
} from 'react-bulma-components'
import { observer } from 'mobx-react-lite'

import { rootStore } from './store'
import { Game } from './Game'

import 'bulma/css/bulma.min.css'

const Home = observer(function () {
	const [roomId, setRoomId] = useState('')
	const [connecting, setConnecting] = useState(false)

	const handleCreateNew = async () => {
		setConnecting(true)
		const roomId = await rootStore.server.createRoom()
		rootStore.server.connect(roomId)
		history.pushState({}, '', `/${roomId}`)
		setConnecting(false)
	}

	const handleJoin = () => {
		if (!roomId) {
			return
		}

		setConnecting(true)
		rootStore.server.connect(roomId)
		history.pushState({}, '', `/${roomId}`)
		setConnecting(false)
	}

	return (
		<Section>
			<Columns vCentered>
				<Columns.Column size="half">
					<Box>
						<Button
							color="primary"
							fullwidth
							disabled={connecting}
							onClick={handleCreateNew}
						>
							Create New
						</Button>
					</Box>
				</Columns.Column>
				<Columns.Column size="half">
					<Box>
						<Form.Field kind="addons">
							<Form.Control fullwidth>
								<Form.Input
									placeholder="room ID..."
									value={roomId}
									onChange={(evt) => setRoomId(evt.currentTarget.value)}
								/>
							</Form.Control>
							<Form.Control>
								<Button
									disabled={!roomId || connecting}
									color="primary"
									onClick={handleJoin}
								>
									Join
								</Button>
							</Form.Control>
						</Form.Field>
					</Box>
				</Columns.Column>
			</Columns>
		</Section>
	)
})

function Loading() {
	return (
		<Section>
			<Progress />
		</Section>
	)
}

export const App = observer(function () {
	const [loggedIn, setLoggedIn] = useState(false)

	useEffect(() => {
		rootStore.server.login().then(async () => {
			const parts = location.pathname.split('/')
			const roomId = parts[1]
			if (roomId) {
				await rootStore.server.connect(roomId)
			}
			setLoggedIn(true)
		})

		window.addEventListener(
			'beforeunload',
			() => {
				rootStore.server.disconnect()
			},
			{ once: true }
		)
	}, [])

	const getComponent = () => {
		if (!loggedIn) {
			return Loading
		}

		if (rootStore.server.connection) {
			return Game
		}

		return Home
	}

	const Component = getComponent()

	return (
		<Container>
			<Component />
		</Container>
	)
})
