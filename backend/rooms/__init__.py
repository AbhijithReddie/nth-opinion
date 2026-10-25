"""
Huddle rooms.

Importing this package registers every room with the engine. To add a room,
write a config module (see group_chat.py) and import it below.
"""

from rooms import group_chat  # noqa: F401  (registers the room)
from rooms.engine import ROOMS, RoomConfig, SummaryError, get_room, stream_turn, summarize

__all__ = ["ROOMS", "RoomConfig", "SummaryError", "get_room", "stream_turn", "summarize"]
