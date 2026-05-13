"""
Campaign template engine — pure function that turns an Event + lineup into
a sequenced list of posts. No I/O.

Spec: wiki/spec/phase_2_3_pivot.md
Output shape: list of dicts ready to insert into the public.posts table
(scheduled_for, post_type, linked_artist_profile_id).
"""
from datetime import datetime, timedelta, timezone


def _utcnow():
    return datetime.now(timezone.utc)


def _stagger_dates(start, end, count):
    """Yield `count` datetimes evenly distributed in [start, end]. count >= 1."""
    if count <= 0:
        return []
    if count == 1:
        return [start + (end - start) / 2]
    span = (end - start) / (count - 1) if count > 1 else timedelta(0)
    return [start + span * i for i in range(count)]


def build_campaign(event_date, lineup, now=None):
    """Build a sequenced post template for a campaign.

    Args:
        event_date: timezone-aware datetime of the event itself
        lineup:     list of {'artist_profile_id': uuid, 'billing_position': str, 'billing_order': int}
                    ordered by billing_order (headliner first)
        now:        override for current time (testing)

    Returns:
        list of {'post_type': str, 'scheduled_for': datetime, 'linked_artist_profile_id': uuid|None}
    """
    if now is None:
        now = _utcnow()
    if event_date.tzinfo is None:
        event_date = event_date.replace(tzinfo=timezone.utc)

    posts = []

    # Announcement — earliest possible, capped at 42 days out
    announcement_date = max(now + timedelta(days=1), event_date - timedelta(days=42))
    if announcement_date < event_date:
        posts.append({
            'post_type': 'announcement',
            'scheduled_for': announcement_date,
            'linked_artist_profile_id': None,
        })

    # Artist spotlights — one per lineup member, staggered.
    # Window: 3 days after announcement → 10 days before event.
    sorted_lineup = sorted(lineup, key=lambda s: s.get('billing_order', 0))
    if sorted_lineup:
        spotlight_start = announcement_date + timedelta(days=3)
        spotlight_end = event_date - timedelta(days=10)
        if spotlight_end > spotlight_start:
            dates = _stagger_dates(spotlight_start, spotlight_end, len(sorted_lineup))
            for i, (slot, when) in enumerate(zip(sorted_lineup, dates)):
                # Skip past spotlights — no point scheduling something for yesterday
                if when <= now:
                    continue
                posts.append({
                    'post_type': 'headliner_spotlight' if i == 0 else 'support_spotlight',
                    'scheduled_for': when,
                    'linked_artist_profile_id': slot.get('artist_profile_id'),
                })

    # Mid-campaign push — ~2 weeks out
    mid_date = event_date - timedelta(days=14)
    if mid_date > now and mid_date < event_date:
        posts.append({
            'post_type': 'mid_campaign_push',
            'scheduled_for': mid_date,
            'linked_artist_profile_id': None,
        })

    # Countdown sequence
    countdown_offsets = [
        (7, 'countdown_7d'),
        (3, 'countdown_3d'),
        (1, 'countdown_1d'),
        (0, 'countdown_day_of'),
    ]
    for offset, post_type in countdown_offsets:
        target = event_date - timedelta(days=offset)
        if target > now:
            posts.append({
                'post_type': post_type,
                'scheduled_for': target,
                'linked_artist_profile_id': None,
            })

    # Day-of doors — same day, +6 hours to push closer to door open
    day_of_doors = event_date.replace(hour=max(event_date.hour - 1, 18), minute=0, second=0, microsecond=0)
    if day_of_doors > now and day_of_doors < event_date:
        posts.append({
            'post_type': 'day_of_doors',
            'scheduled_for': day_of_doors,
            'linked_artist_profile_id': None,
        })

    # Recap — 24 hours after
    recap_date = event_date + timedelta(days=1)
    posts.append({
        'post_type': 'recap',
        'scheduled_for': recap_date,
        'linked_artist_profile_id': None,
    })

    # Sort chronologically
    posts.sort(key=lambda p: p['scheduled_for'])
    return posts
