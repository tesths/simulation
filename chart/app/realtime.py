from __future__ import annotations

from fastapi import WebSocket


class TeacherConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast_group_update(self, classroom_id: int, group_id: int) -> None:
        stale_connections: list[WebSocket] = []
        for connection in list(self._connections):
            try:
                await connection.send_json(
                    {
                        "type": "group-updated",
                        "classroom_id": classroom_id,
                        "group_id": group_id,
                    }
                )
            except Exception:
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(connection)
