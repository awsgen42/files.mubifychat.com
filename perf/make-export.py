"""
A synthetic Instagram "Download your information" export, ~2 GB.

Not a real archive — I have no real export — so every number measured against
this is labelled synthetic. What it does reproduce, deliberately:

  * the directory shape: your_instagram_activity/messages/inbox/<thread>/
  * threads split across message_1.json, message_2.json …, each file
    newest-first, and NOT ordered across files
  * Instagram's encoding bug: UTF-8 bytes emitted as latin-1 code points, so
    Urdu, Arabic and emoji arrive corrupted
  * is_unsent records: sender and timestamp survive, content does not
  * media as separate entries under photos/ and videos/, incompressible so the
    zip is genuinely large rather than compressing to nothing
  * one 50k-message thread, one 320-photo thread, 100k messages overall
"""
import json, os, random, sys, zipfile

OUT = sys.argv[1]
TARGET_BYTES = int(float(sys.argv[2]) * 1024**3) if len(sys.argv) > 2 else 2 * 1024**3
# --media-heavy: few threads, almost all of the bytes in photos and video
# attached to messages, which is what actually breaks a phone. Padding an
# archive with unattached media would inflate the file without inflating what
# the viewer has to render, and would not test the thing being tested.
MEDIA_HEAVY = '--media-heavy' in sys.argv
# --big-media: the same total in far fewer, far larger attachments. The
# media-heavy fixture is 4,200 photos of 180 KB, which tests the count; a
# handful of long videos tests something different — whether materialising one
# blob is itself the problem — and the two cannot be told apart in one archive.
BIG_MEDIA = '--big-media' in sys.argv
MEDIA_ITEM_BYTES = 15_000_000 if BIG_MEDIA else 180_000
random.seed(20260826)

ROOT = 'your_instagram_activity/messages/inbox'
OWNER = 'Alex Rivera'

# zipfile stamps the current time into every local header, which made two runs
# of this script differ in bytes while containing identical data. The fixture
# is meant to be regenerable and checkable against a recorded digest, so the
# timestamp is pinned.
FIXED_TIME = (2026, 8, 26, 12, 0, 0)


def put(zf, name, data, compress=zipfile.ZIP_STORED):
    info = zipfile.ZipInfo(name, date_time=FIXED_TIME)
    info.compress_type = compress
    info.external_attr = 0o600 << 16
    zf.writestr(info, data)


def mojibake(text: str) -> str:
    """What Instagram writes: UTF-8 bytes, each byte kept as a code point."""
    return ''.join(chr(b) for b in text.encode('utf-8'))

# Real strings that break naive parsers, kept here so the tests can assert the
# exact round trip rather than a shape.
SAMPLES = [
    ('urdu', 'السلام علیکم، کیا حال ہے؟'),
    ('arabic', 'مرحبا كيف حالك اليوم'),
    ('emoji', 'that was so funny 😂😂 let me know 👍🏽'),
    ('accents', 'On se retrouve à la gare — d’accord ?'),
    ('mixed', 'ok 👍 سلام café'),
]
PLAIN = [
    'yeah sounds good', 'lol', 'are you free tomorrow', 'sent you the file',
    'ok see you then', 'that is hilarious', 'call me when you can',
]

NAMES = ['Sam Okafor', 'Priya Nair', 'Jonas Weber', 'Mei Lin', 'Tomás Alvarez']

def message(i, ts, sender, kind='text', thread=''):
    m = {'sender_name': mojibake(sender), 'timestamp_ms': ts}
    if kind == 'text':
        if i % 11 == 0:
            m['content'] = mojibake(SAMPLES[i % len(SAMPLES)][1])
        else:
            m['content'] = PLAIN[i % len(PLAIN)]
    elif kind == 'unsent':
        # Sender and timestamp survive; the content does not. Never an empty
        # bubble — a distinct state.
        m['is_unsent'] = True
    elif kind == 'photo':
        m['photos'] = [{'uri': f'{ROOT}/{thread}/photos/{i:04d}.jpg',
                        'creation_timestamp': ts // 1000}]
    elif kind == 'video':
        m['videos'] = [{'uri': f'{ROOT}/{thread}/videos/{i:04d}.mp4',
                        'creation_timestamp': ts // 1000}]
    if i % 23 == 0:
        m['reactions'] = [{'reaction': mojibake('❤'), 'actor': mojibake(NAMES[i % len(NAMES)])}]
    return m

BASE_TS = 1_600_000_000_000

def write_thread(zf, slug, other, count, kind_at, media_files=0, split_every=10_000):
    """One thread, its messages split across files, newest-first within each."""
    kinds = [kind_at(i) for i in range(count)]
    msgs = [message(i, BASE_TS + i * 60_000, OWNER if i % 2 else other, kinds[i], slug)
            for i in range(count)]
    chunks = [msgs[i:i + split_every] for i in range(0, len(msgs), split_every)] or [[]]
    # Instagram writes the newest messages in message_1.json.
    chunks.reverse()
    for n, chunk in enumerate(chunks, start=1):
        doc = {
            'participants': [{'name': mojibake(other)}, {'name': mojibake(OWNER)}],
            'messages': list(reversed(chunk)),          # newest first inside the file
            'title': mojibake(other),
            'thread_path': f'inbox/{slug}',
            'magic_words': [],
        }
        put(zf, f'{ROOT}/{slug}/message_{n}.json',
            json.dumps(doc, ensure_ascii=True), zipfile.ZIP_DEFLATED)
    # Media files are named for the message that references them, capped at
    # media_files. Writing 0..media_files-1 instead left most attachments
    # pointing at entries that were never written, so a media measurement was
    # half measuring the missing-attachment path.
    wanted = [(i, kinds[i]) for i in range(count) if kinds[i] in ('photo', 'video')][:media_files]
    for i, kind in wanted:
        # Incompressible, like a real JPEG or an H.264 stream.
        folder, ext = ('videos', 'mp4') if kind == 'video' else ('photos', 'jpg')
        put(zf, f'{ROOT}/{slug}/{folder}/{i:04d}.{ext}', random.randbytes(MEDIA_ITEM_BYTES))

total_messages = 0
if MEDIA_HEAVY:
    with zipfile.ZipFile(OUT, 'w', allowZip64=True) as zf:
        put(zf, 'your_instagram_activity/messages/inbox/.keep', b'')
        thread_no = 0
        while os.path.getsize(OUT) < TARGET_BYTES:
            slug = f'mediathread{thread_no:03d}_1784140000009{thread_no:03d}'
            # Every referenced attachment is written. Referencing more than
            # exist would have most rows render "not in this archive", which
            # measures the missing path rather than the media path.
            write_thread(zf, slug, NAMES[thread_no % len(NAMES)], 900,
                         (lambda i: 'video' if i % 75 == 0 else 'text') if BIG_MEDIA
                         else (lambda i: 'photo' if i % 2 else 'text'),
                         media_files=12 if BIG_MEDIA else 450)
            total_messages += 900
            thread_no += 1
            print(f'  media-heavy… {os.path.getsize(OUT) / 1024**3:.2f} GB, {thread_no} threads', flush=True)
    size = os.path.getsize(OUT)
    with zipfile.ZipFile(OUT) as zf:
        entries = len(zf.namelist())
    print(f'wrote {OUT}: {size} bytes ({size / 1024**3:.2f} GB), {entries} entries, '
          f'{total_messages} messages, {"big-media" if BIG_MEDIA else "media-heavy"}', flush=True)
    sys.exit(0)

with zipfile.ZipFile(OUT, 'w', allowZip64=True) as zf:
    put(zf, 'your_instagram_activity/messages/inbox/.keep', b'')

    # The long one: 50k messages, split across six files.
    write_thread(zf, 'longthread_17841400000000001', 'Sam Okafor', 50_000,
                 lambda i: 'unsent' if i % 500 == 0 else 'text')
    total_messages += 50_000

    # The media one: 320 photos, so the blob lifecycle has something to chew.
    write_thread(zf, 'photothread_17841400000000002', 'Priya Nair', 1_200,
                 lambda i: 'photo' if i % 4 == 0 else 'text', media_files=320)
    total_messages += 1_200

    # Enough ordinary threads to reach 100k messages overall.
    remaining = 100_000 - total_messages
    per = remaining // 197
    for t in range(197):
        name = f'{NAMES[t % len(NAMES)]} {t}'
        write_thread(zf, f'thread{t:03d}_1784140000000{t:04d}', name, per,
                     lambda i: 'video' if i % 97 == 0 else 'text')
        total_messages += per

    # Pad with media until the archive is the size we said it was.
    pad = 0
    while os.path.getsize(OUT) < TARGET_BYTES:
        put(zf, f'your_instagram_activity/media/posts/pad{pad:05d}.jpg',
            random.randbytes(4_000_000))
        pad += 1
        if pad % 50 == 0:
            print(f'  padding… {os.path.getsize(OUT) / 1024**3:.2f} GB', flush=True)

size = os.path.getsize(OUT)
with zipfile.ZipFile(OUT) as zf:
    entries = len(zf.namelist())
print(f'wrote {OUT}: {size} bytes ({size / 1024**3:.2f} GB), {entries} entries, '
      f'{total_messages} messages', flush=True)
