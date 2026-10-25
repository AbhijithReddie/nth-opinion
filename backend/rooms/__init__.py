"""
Huddle rooms.

Importing this package registers every room with the engine. To add a room,
write a config module (see group_chat.py) and import it below.
"""

from rooms import (  # noqa: F401  (importing a room module registers it)
    future_you,
    group_chat,
    interview_panel,
    roast_and_toast,
    shark_tank,
    study_group,
)
from rooms.engine import ROOMS, RoomConfig, SummaryError, get_room, stream_turn, summarize

__all__ = ["ROOMS", "RoomConfig", "SummaryError", "get_room", "stream_turn", "summarize"]
