"""ROM preparation regression tests using invented tiny data, never game ROMs."""
import hashlib
import importlib.util
import io
import subprocess
import sys
import tempfile
import unittest
import zipfile
import zlib
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / 'scripts/prepare-catalog-roms.py'
spec = importlib.util.spec_from_file_location('prepare_roms', SCRIPT)
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def archive(name='component.bin', data=b'invented test bytes', comment=b''):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        info = zipfile.ZipInfo(name, (2000, 1, 1, 0, 0, 0))
        info.create_system = 0
        info.compress_type = zipfile.ZIP_DEFLATED
        output.writestr(info, data)
        output.comment = comment
    return stream.getvalue()


class PreparationTests(unittest.TestCase):
    def setUp(self):
        cache = (ROOT / '.cache/tests').resolve()
        cache.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='rom-prepare-', dir=cache)
        assert Path(self.temp.name).resolve().is_relative_to(cache)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.destination = self.root / 'source', self.root / 'destination'
        self.source.mkdir()
        self.destination.mkdir()
        self.payload = b'invented test bytes'
        self.canonical = archive()
        self.game = {'id': 'fixture', 'parent': 'parent',
                     'expected_sha256': hashlib.sha256(self.canonical).hexdigest(),
                     'roms': [{'name': 'component.bin', 'size': len(self.payload),
                               'crc': f'{zlib.crc32(self.payload):08x}'}]}
        (self.source / 'parent.zip').write_bytes(archive('clone/old-name.bin'))

    def test_rebuild_renames_by_crc_and_pins_cross_platform_zip_header(self):
        original = (self.source / 'parent.zip').read_bytes()
        constructor = zipfile.ZipInfo

        class UnixHeader(constructor):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.create_system = 3

        with patch.object(prepare.zipfile, 'ZipInfo', UnixHeader):
            result = prepare.prepare_game(self.game, self.source, None, self.destination)
        self.assertEqual(result['sha256'], self.game['expected_sha256'])
        self.assertEqual((self.destination / 'fixture.zip').read_bytes(), self.canonical)
        self.assertEqual((self.source / 'parent.zip').read_bytes(), original)

    def test_original_archive_preserves_every_byte(self):
        original = archive(comment=b'original archive headers are preserved')
        (self.source / 'fixture.zip').write_bytes(original)
        self.game.update(copy_approved_archive=True, expected_sha256=hashlib.sha256(original).hexdigest())
        prepare.prepare_game(self.game, self.source, None, self.destination)
        self.assertEqual((self.destination / 'fixture.zip').read_bytes(), original)

    def test_wrong_original_does_not_replace_existing_archive(self):
        self.game['copy_approved_archive'] = True
        target = self.destination / 'fixture.zip'
        target.write_bytes(b'previous archive')
        with self.assertRaisesRegex(ValueError, 'ZIP original'):
            prepare.prepare_game(self.game, self.source, None, self.destination)
        self.assertEqual(target.read_bytes(), b'previous archive')

    def test_wrong_final_hash_does_not_replace_or_leave_partial_file(self):
        self.game['expected_sha256'] = '0' * 64
        target = self.destination / 'fixture.zip'
        target.write_bytes(b'previous archive')
        with self.assertRaisesRegex(ValueError, 'SHA-256 distinto'):
            prepare.prepare_game(self.game, self.source, None, self.destination)
        self.assertEqual(target.read_bytes(), b'previous archive')
        self.assertFalse((self.destination / 'fixture.zip.partial').exists())

    def test_missing_component_does_not_create_an_archive(self):
        self.game['roms'][0]['crc'] = '00000000'
        with self.assertRaisesRegex(ValueError, 'faltan componentes'):
            prepare.prepare_game(self.game, self.source, None, self.destination)
        self.assertEqual(list(self.destination.iterdir()), [])

    def test_unknown_identifier_and_source_destination_collision_are_rejected(self):
        for args in [
            ['--games', 'not-a-real-game', '--destination', str(self.destination)],
            ['--destination', str(self.source)],
        ]:
            result = subprocess.run([sys.executable, str(SCRIPT), str(self.source), *args], capture_output=True)
            self.assertEqual(result.returncode, 2, result.stderr)
        self.assertEqual(list(self.destination.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
