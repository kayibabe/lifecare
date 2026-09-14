from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {'.git', 'node_modules', 'dist', '.venv', '__pycache__'}
TEXT_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.py', '.dart', '.yaml', '.yml', '.toml',
    '.json', '.html', '.css', '.bat', '.conf', '.md', '.txt', '.xml', '.plist',
    '.gradle', '.kts', '.ini', '.lock', '.example', ''
}

def replace_terms(value: str) -> str:
    value = value.replace('General Private Clinic', 'LifeCare')
    value = value.replace('Mtowera Private Clinic', 'LifeCare')
    value = re.sub(r'(?i)gpc', lambda m: 'LifeCare' if m.group(0).isupper() else 'lifecare', value)
    value = re.sub(r'(?i)mpc', lambda m: 'LifeCare' if m.group(0).isupper() else 'lifecare', value)
    return value

def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)

for path in ROOT.rglob('*'):
    if not path.is_file() or should_skip(path) or path.name == Path(__file__).name:
        continue
    if path.suffix.lower() not in TEXT_EXTENSIONS:
        continue
    try:
        old = path.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        continue
    new = replace_terms(old)
    if new != old:
        path.write_text(new, encoding='utf-8', newline='')

for path in ROOT.rglob('*.docx'):
    if should_skip(path):
        continue
    with ZipFile(path, 'r') as source:
        with tempfile.NamedTemporaryFile(delete=False, dir=path.parent, suffix='.docx') as tmp:
            temp_path = Path(tmp.name)
        with ZipFile(temp_path, 'w', ZIP_DEFLATED) as target:
            for item in source.infolist():
                data = source.read(item.filename)
                if item.filename.endswith('.xml') or item.filename.endswith('.rels'):
                    try:
                        text = data.decode('utf-8')
                        data = replace_terms(text).encode('utf-8')
                    except UnicodeDecodeError:
                        pass
                target.writestr(item, data)
    temp_path.replace(path)

print('legacy terms replaced')
