"""Package a runnable source download, without checkout state or hosting identity."""
from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
output=root/'work/earth-jukebox-source.zip'
output.parent.mkdir(parents=True,exist_ok=True)
excluded={'node_modules','.git','.openai','dist','.local','downloads','work','__pycache__'}
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        relative=path.relative_to(root)
        if relative.parts[:2] == ('public','runtime'):continue
        if not path.is_file() or excluded.intersection(relative.parts):continue
        archive.write(path,Path('earth-jukebox')/relative)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
print(f'Packaged {output.name}: {output.stat().st_size} bytes')
