"""Prepare the pinned catalog from local MAME/FBNeo collections, without downloads.

Only components with the exact size/CRC from config/catalog-romsets.json are used.
The complete archive SHA-256 must match before replacing any installed file.
"""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def prepare_game(game, source, fallback, destination):
    ident = game['id']
    expected = game['expected_sha256']
    parents = list(dict.fromkeys([ident, *game.get('parents', [game['parent']])]))
    paths = [directory / (parent + '.zip')
             for directory in [source, fallback] if directory
             for parent in parents]
    paths = list(dict.fromkeys(path for path in paths if path.is_file()))
    target = destination / (ident + '.zip')
    temporary = target.with_suffix('.zip.partial')
    archives = []
    sources = set()
    try:
        # Preserve original compression/headers for the six base archives.
        original = next((path for path in paths if digest(path) == expected), None)
        if original:
            temporary.write_bytes(original.read_bytes())
            sources.add(str(original))
        elif game.get('copy_approved_archive'):
            raise ValueError('se necesita el ZIP original aprobado del romset FBNeo; '
                             'el SHA-256 no coincide o falta el archivo')
        else:
            for path in paths:
                archives.append((path, zipfile.ZipFile(path)))
            contents = []
            missing = []
            for rom in game['roms']:
                found = None
                for path, archive in archives:
                    item = next((item for item in archive.infolist()
                                 if item.CRC == int(rom['crc'], 16)
                                 and item.file_size == rom['size']), None)
                    if item:
                        found = archive.read(item)
                        sources.add(str(path))
                        break
                if found is None:
                    missing.append(rom['name'])
                else:
                    contents.append((rom, found))
            if missing:
                raise ValueError('faltan componentes: ' + ', '.join(missing))
            with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED,
                                 compresslevel=6) as output:
                for rom, data in contents:
                    info = zipfile.ZipInfo(rom['name'], tuple(
                        rom.get('zip_date', (2000, 1, 1, 0, 0, 0))))
                    # The pinned archives were created on Windows. Keep that
                    # header value on Linux as well, so the SHA-256 is stable.
                    info.create_system = 0
                    info.compress_type = zipfile.ZIP_DEFLATED
                    output.writestr(info, data)
        if digest(temporary) != expected:
            raise ValueError('ZIP reconstruido con un SHA-256 distinto al aprobado; '
                             'se conserva el archivo instalado')
        temporary.replace(target)
        return {'name': target.name, 'bytes': target.stat().st_size,
                'sha256': expected, 'sources': sorted(sources)}
    finally:
        for _, archive in archives:
            archive.close()
        temporary.unlink(missing_ok=True)


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Local MAME or FBNeo ZIP directory')
    parser.add_argument('--fallback', type=Path, help='Optional second local collection')
    parser.add_argument('--destination', type=Path, default=root / 'data/roms')
    parser.add_argument('--games', nargs='+', help='Only prepare these game/BIOS identifiers')
    args = parser.parse_args()
    args.source = args.source.resolve()
    args.fallback = args.fallback.resolve() if args.fallback else None
    args.destination = args.destination.resolve()
    if args.destination in [args.source, args.fallback]:
        parser.error('el destino no puede ser una colección de origen')
    if not args.source.is_dir() or (args.fallback and not args.fallback.is_dir()):
        parser.error('no existe una de las carpetas de origen')
    definitions = json.loads((root / 'config/catalog-romsets.json').read_text(encoding='utf-8'))
    unknown = set(args.games or []) - {game['id'] for game in definitions}
    if unknown:
        parser.error('identificadores desconocidos: ' + ', '.join(sorted(unknown)))
    args.destination.mkdir(parents=True, exist_ok=True)
    manifest_path = args.destination / 'import-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'files': []}
    files = {entry['name']: entry for entry in manifest['files']}
    failed = False
    for game in definitions:
        if args.games and game['id'] not in args.games:
            continue
        try:
            entry = prepare_game(game, args.source, args.fallback, args.destination)
            files[entry['name']] = entry
            print(game['id'] + ': preparado y SHA-256 aprobado', flush=True)
        except (ValueError, OSError, zipfile.BadZipFile) as error:
            failed = True
            print(game['id'] + ': ' + str(error), flush=True)
    manifest['files'] = list(files.values())
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    raise SystemExit(1 if failed else 0)


if __name__ == '__main__':
    main()
