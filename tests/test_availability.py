"""
Unit tests for availability matching logic.

These tests exercise the overlap detection and conflict identification logic
used by the meetup proposal feature. No Google OAuth, database, or running
server is required — all logic is tested directly.
"""
from datetime import datetime, timezone, timedelta


def dt(year=2026, month=6, day=8, hour=0, minute=0):
    """Create a UTC-aware datetime for use in tests."""
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Core overlap predicate (mirrors the query filter in routes.py)
# ---------------------------------------------------------------------------

def overlaps(a_start, a_end, b_start, b_end):
    """Return True if interval [a_start, a_end) overlaps [b_start, b_end)."""
    return a_start < b_end and b_start < a_end


class TestOverlapPredicate:
    def test_clear_overlap(self):
        assert overlaps(dt(hour=9), dt(hour=11), dt(hour=10), dt(hour=12))

    def test_no_overlap_before(self):
        assert not overlaps(dt(hour=8), dt(hour=9), dt(hour=10), dt(hour=11))

    def test_no_overlap_after(self):
        assert not overlaps(dt(hour=12), dt(hour=13), dt(hour=10), dt(hour=11))

    def test_adjacent_intervals_do_not_overlap(self):
        # [9, 10) and [10, 11) share no interior — not a conflict
        assert not overlaps(dt(hour=9), dt(hour=10), dt(hour=10), dt(hour=11))

    def test_one_contains_other(self):
        assert overlaps(dt(hour=8), dt(hour=17), dt(hour=9), dt(hour=10))

    def test_identical_intervals(self):
        assert overlaps(dt(hour=9), dt(hour=10), dt(hour=9), dt(hour=10))

    def test_partial_overlap_start(self):
        assert overlaps(dt(hour=9), dt(hour=11), dt(hour=8), dt(hour=10))

    def test_partial_overlap_end(self):
        assert overlaps(dt(hour=9), dt(hour=11), dt(hour=10), dt(hour=13))

    def test_zero_length_interval_point_inside_range(self):
        # A zero-length interval at t=10 is treated as a point.
        # The predicate returns True when that point falls inside another interval,
        # which is consistent with the SQLAlchemy filters used in routes.py.
        assert overlaps(dt(hour=10), dt(hour=10), dt(hour=9), dt(hour=11))


# ---------------------------------------------------------------------------
# Conflict detection (simulates the proposal endpoint logic)
# ---------------------------------------------------------------------------

class FakeBusyInterval:
    def __init__(self, user_id, start, end):
        self.user_id = user_id
        self.start = start
        self.end = end


class FakeSpecialEvent:
    def __init__(self, user_id, group_id, kind, start, end):
        self.user_id = user_id
        self.group_id = group_id
        self.kind = kind
        self.start = start
        self.end = end


def find_conflicts(proposal_start, proposal_end, busy_intervals, block_offs):
    """
    Mirror of the conflict detection logic in routes.py add_proposal().
    Returns the set of user_ids that conflict with the proposed time.
    """
    conflict_ids = set()
    for b in busy_intervals:
        if overlaps(b.start, b.end, proposal_start, proposal_end):
            conflict_ids.add(b.user_id)
    for s in block_offs:
        if overlaps(s.start, s.end, proposal_start, proposal_end):
            conflict_ids.add(s.user_id)
    return conflict_ids


class TestConflictDetection:
    def test_no_conflicts_when_everyone_free(self):
        proposal_start = dt(hour=14)
        proposal_end = dt(hour=15)
        busy = [
            FakeBusyInterval(user_id=1, start=dt(hour=9), end=dt(hour=10)),
            FakeBusyInterval(user_id=2, start=dt(hour=11), end=dt(hour=12)),
        ]
        conflicts = find_conflicts(proposal_start, proposal_end, busy, [])
        assert conflicts == set()

    def test_single_conflict(self):
        proposal_start = dt(hour=14)
        proposal_end = dt(hour=15)
        busy = [
            FakeBusyInterval(user_id=1, start=dt(hour=13), end=dt(hour=15)),
            FakeBusyInterval(user_id=2, start=dt(hour=9), end=dt(hour=10)),
        ]
        conflicts = find_conflicts(proposal_start, proposal_end, busy, [])
        assert conflicts == {1}

    def test_multiple_conflicts(self):
        proposal_start = dt(hour=10)
        proposal_end = dt(hour=11)
        busy = [
            FakeBusyInterval(user_id=1, start=dt(hour=9), end=dt(hour=11)),
            FakeBusyInterval(user_id=2, start=dt(hour=10, minute=30), end=dt(hour=12)),
            FakeBusyInterval(user_id=3, start=dt(hour=8), end=dt(hour=9)),
        ]
        conflicts = find_conflicts(proposal_start, proposal_end, busy, [])
        assert conflicts == {1, 2}

    def test_block_off_counts_as_conflict(self):
        proposal_start = dt(hour=14)
        proposal_end = dt(hour=15)
        busy = []
        block_offs = [
            FakeSpecialEvent(user_id=5, group_id=1, kind="block_off",
                             start=dt(hour=14), end=dt(hour=16)),
        ]
        conflicts = find_conflicts(proposal_start, proposal_end, busy, block_offs)
        assert conflicts == {5}

    def test_block_off_and_busy_both_contribute(self):
        proposal_start = dt(hour=10)
        proposal_end = dt(hour=11)
        busy = [FakeBusyInterval(user_id=1, start=dt(hour=10), end=dt(hour=11))]
        block_offs = [
            FakeSpecialEvent(user_id=2, group_id=1, kind="block_off",
                             start=dt(hour=9), end=dt(hour=10, minute=30)),
        ]
        conflicts = find_conflicts(proposal_start, proposal_end, busy, block_offs)
        assert conflicts == {1, 2}

    def test_same_user_counted_once(self):
        proposal_start = dt(hour=10)
        proposal_end = dt(hour=11)
        busy = [
            FakeBusyInterval(user_id=1, start=dt(hour=9), end=dt(hour=11)),
            FakeBusyInterval(user_id=1, start=dt(hour=10), end=dt(hour=12)),
        ]
        conflicts = find_conflicts(proposal_start, proposal_end, busy, [])
        assert conflicts == {1}

    def test_adjacent_busy_interval_is_not_a_conflict(self):
        # busy ends exactly when proposal starts — not a conflict
        proposal_start = dt(hour=10)
        proposal_end = dt(hour=11)
        busy = [FakeBusyInterval(user_id=1, start=dt(hour=9), end=dt(hour=10))]
        conflicts = find_conflicts(proposal_start, proposal_end, busy, [])
        assert conflicts == set()

    def test_empty_group_has_no_conflicts(self):
        proposal_start = dt(hour=10)
        proposal_end = dt(hour=11)
        conflicts = find_conflicts(proposal_start, proposal_end, [], [])
        assert conflicts == set()


# ---------------------------------------------------------------------------
# Interval merging (for computing truly free slots from multiple busy blocks)
# ---------------------------------------------------------------------------

def merge_intervals(intervals):
    """Merge a list of (start, end) tuples into non-overlapping intervals."""
    if not intervals:
        return []
    sorted_ivs = sorted(intervals, key=lambda iv: iv[0])
    merged = [sorted_ivs[0]]
    for start, end in sorted_ivs[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


class TestMergeIntervals:
    def test_no_intervals(self):
        assert merge_intervals([]) == []

    def test_single_interval(self):
        iv = [(dt(hour=9), dt(hour=10))]
        assert merge_intervals(iv) == iv

    def test_non_overlapping_stays_separate(self):
        ivs = [(dt(hour=9), dt(hour=10)), (dt(hour=11), dt(hour=12))]
        assert merge_intervals(ivs) == ivs

    def test_overlapping_merges(self):
        ivs = [(dt(hour=9), dt(hour=11)), (dt(hour=10), dt(hour=12))]
        assert merge_intervals(ivs) == [(dt(hour=9), dt(hour=12))]

    def test_adjacent_merges(self):
        ivs = [(dt(hour=9), dt(hour=10)), (dt(hour=10), dt(hour=11))]
        assert merge_intervals(ivs) == [(dt(hour=9), dt(hour=11))]

    def test_contained_interval_dropped(self):
        ivs = [(dt(hour=8), dt(hour=17)), (dt(hour=9), dt(hour=10))]
        assert merge_intervals(ivs) == [(dt(hour=8), dt(hour=17))]

    def test_multiple_merge_to_one(self):
        ivs = [
            (dt(hour=9), dt(hour=10)),
            (dt(hour=9, minute=30), dt(hour=11)),
            (dt(hour=10, minute=45), dt(hour=12)),
        ]
        assert merge_intervals(ivs) == [(dt(hour=9), dt(hour=12))]

    def test_unsorted_input(self):
        ivs = [(dt(hour=11), dt(hour=12)), (dt(hour=9), dt(hour=10))]
        assert merge_intervals(ivs) == [(dt(hour=9), dt(hour=10)), (dt(hour=11), dt(hour=12))]


# ---------------------------------------------------------------------------
# Free slot computation (inverse of merged busy intervals within a window)
# ---------------------------------------------------------------------------

def free_slots(busy_merged, window_start, window_end, min_duration_minutes=30):
    """
    Return free slots within [window_start, window_end) that are at least
    min_duration_minutes long, given a sorted list of merged busy intervals.
    """
    slots = []
    cursor = window_start
    min_duration = timedelta(minutes=min_duration_minutes)

    for b_start, b_end in busy_merged:
        if b_start > cursor:
            slot_end = min(b_start, window_end)
            if slot_end - cursor >= min_duration:
                slots.append((cursor, slot_end))
        cursor = max(cursor, b_end)

    if window_end - cursor >= min_duration:
        slots.append((cursor, window_end))

    return slots


class TestFreeSlots:
    def test_no_busy_entire_window_is_free(self):
        w_start = dt(hour=9)
        w_end = dt(hour=17)
        slots = free_slots([], w_start, w_end)
        assert slots == [(w_start, w_end)]

    def test_fully_busy_window(self):
        w_start = dt(hour=9)
        w_end = dt(hour=17)
        busy = [(dt(hour=9), dt(hour=17))]
        assert free_slots(busy, w_start, w_end) == []

    def test_busy_in_middle(self):
        w_start = dt(hour=9)
        w_end = dt(hour=17)
        busy = [(dt(hour=12), dt(hour=13))]
        slots = free_slots(busy, w_start, w_end)
        assert slots == [(dt(hour=9), dt(hour=12)), (dt(hour=13), dt(hour=17))]

    def test_min_duration_filters_short_slots(self):
        w_start = dt(hour=9)
        w_end = dt(hour=11)
        # 15-minute gap between 9:45 and 10:00
        busy = [(dt(hour=9), dt(hour=9, minute=45)), (dt(hour=10), dt(hour=11))]
        # 30-minute minimum should filter out the 15-minute gap
        slots = free_slots(busy, w_start, w_end, min_duration_minutes=30)
        assert slots == []

    def test_min_duration_keeps_sufficient_slots(self):
        w_start = dt(hour=9)
        w_end = dt(hour=17)
        busy = [(dt(hour=12), dt(hour=13))]
        # 3-hour morning slot and 4-hour afternoon slot both qualify
        slots = free_slots(busy, w_start, w_end, min_duration_minutes=30)
        assert len(slots) == 2

    def test_busy_extends_past_window(self):
        w_start = dt(hour=9)
        w_end = dt(hour=11)
        busy = [(dt(hour=10), dt(hour=13))]
        slots = free_slots(busy, w_start, w_end, min_duration_minutes=30)
        assert slots == [(dt(hour=9), dt(hour=10))]


# ---------------------------------------------------------------------------
# Group availability intersection (common free slots across multiple users)
# ---------------------------------------------------------------------------

def intersect_free_slots(all_user_slots):
    """
    Given a list of free-slot lists (one per user), return only the time
    intervals that are free for every user.
    """
    if not all_user_slots:
        return []
    result = all_user_slots[0][:]
    for user_slots in all_user_slots[1:]:
        new_result = []
        for r_start, r_end in result:
            for u_start, u_end in user_slots:
                i_start = max(r_start, u_start)
                i_end = min(r_end, u_end)
                if i_start < i_end:
                    new_result.append((i_start, i_end))
        result = new_result
    return result


class TestGroupAvailabilityIntersection:
    def test_single_user_returns_their_slots(self):
        user1 = [(dt(hour=9), dt(hour=12))]
        assert intersect_free_slots([user1]) == user1

    def test_two_users_full_overlap(self):
        user1 = [(dt(hour=9), dt(hour=12))]
        user2 = [(dt(hour=9), dt(hour=12))]
        assert intersect_free_slots([user1, user2]) == [(dt(hour=9), dt(hour=12))]

    def test_two_users_partial_overlap(self):
        user1 = [(dt(hour=9), dt(hour=12))]
        user2 = [(dt(hour=10), dt(hour=14))]
        result = intersect_free_slots([user1, user2])
        assert result == [(dt(hour=10), dt(hour=12))]

    def test_no_overlap(self):
        user1 = [(dt(hour=9), dt(hour=10))]
        user2 = [(dt(hour=11), dt(hour=12))]
        assert intersect_free_slots([user1, user2]) == []

    def test_three_users_intersection(self):
        user1 = [(dt(hour=9), dt(hour=17))]
        user2 = [(dt(hour=10), dt(hour=15))]
        user3 = [(dt(hour=11), dt(hour=14))]
        result = intersect_free_slots([user1, user2, user3])
        assert result == [(dt(hour=11), dt(hour=14))]

    def test_empty_user_list(self):
        assert intersect_free_slots([]) == []

    def test_one_user_with_no_slots(self):
        user1 = [(dt(hour=9), dt(hour=12))]
        user2 = []
        result = intersect_free_slots([user1, user2])
        assert result == []

    def test_multiple_free_slots_per_user(self):
        user1 = [(dt(hour=9), dt(hour=11)), (dt(hour=13), dt(hour=15))]
        user2 = [(dt(hour=10), dt(hour=14))]
        result = intersect_free_slots([user1, user2])
        assert result == [(dt(hour=10), dt(hour=11)), (dt(hour=13), dt(hour=14))]


# ---------------------------------------------------------------------------
# Timezone UTC normalization
# ---------------------------------------------------------------------------

class TestTimezoneNormalization:
    def test_naive_datetime_is_not_utc_aware(self):
        naive = datetime(2026, 6, 8, 10, 0)
        assert naive.tzinfo is None

    def test_utc_aware_datetime(self):
        aware = dt(hour=10)
        assert aware.tzinfo is not None
        assert aware.utcoffset().total_seconds() == 0

    def test_two_equivalent_utc_times_compare_equal(self):
        t1 = datetime(2026, 6, 8, 10, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 6, 8, 10, 0, tzinfo=timezone.utc)
        assert t1 == t2

    def test_offset_interval_ordering(self):
        earlier = dt(hour=9)
        later = dt(hour=10)
        assert earlier < later
        assert not (later < earlier)
