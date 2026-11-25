from datetime import datetime, timezone, timedelta
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
spec = spec_from_file_location('phase_availability', Path(__file__).parents[1]/'app/services/availability.py')
module = module_from_spec(spec)
spec.loader.exec_module(module)
member_state = module.member_state
utc = module.utc
A = datetime(2026, 11, 25, 10, tzinfo=timezone.utc)
B = A + timedelta(hours=1)

def test_verified_empty_is_free():
    assert member_state(A, B, [], [], [], True) == 'free'

def test_unverified_empty_is_unknown():
    assert member_state(A, B, [], [], [], False) == 'unknown'

def test_block_wins():
    assert member_state(A, B, [], [(A,B)], [(A,B)], True) == 'busy'

def test_partial_override_does_not_cancel_whole_busy_interval():
    assert member_state(A,B,[(A,B)],[(A,A+timedelta(minutes=30))],[],True)=='busy'

def test_adjacent_overrides_cover_busy_interval():
    middle=A+timedelta(minutes=30)
    assert member_state(A,B,[(A,B)],[(A,middle),(middle,B)],[],True)=='free'

def test_manual_free_covers_unverified():
    assert member_state(A,B,[],[(A,B)],[],False)=='free'

def test_adjacent_busy_not_overlap():
    assert member_state(A,B,[(A-timedelta(hours=1),A)],[],[],True)=='free'

def test_timezone_normalization():
    assert utc('2026-11-25T18:00:00+08:00')==A
