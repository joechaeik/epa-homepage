import json, base64, os, sys

fpath = r'C:\Users\joech\.claude\projects\C--Claude-Code-KENTECH\84de5955-24ce-49b4-9959-9c8c63f7c8d4.jsonl'
out_dir = r'C:\Claude Code_KENTECH\images\gallery'
os.makedirs(out_dir, exist_ok=True)

saved = []

def find_images(node, line_num, depth=0):
    if depth > 30:
        return
    if isinstance(node, dict):
        if node.get('type') == 'image':
            src = node.get('source', {})
            if src.get('type') == 'base64':
                media_type = src.get('media_type', 'image/jpeg')
                data = src.get('data', '')
                ext = 'jpg' if 'jpeg' in media_type else media_type.split('/')[-1]
                outpath = os.path.join(out_dir, f'gallery_upload_{line_num}.{ext}')
                with open(outpath, 'wb') as img_f:
                    img_f.write(base64.b64decode(data))
                saved.append(outpath)
                print(f'Saved: {outpath} ({len(data)} b64 chars, ~{len(data)*3//4//1024} KB)')
                return
        for v in node.values():
            find_images(v, line_num, depth+1)
    elif isinstance(node, list):
        for item in node:
            find_images(item, line_num, depth+1)

with open(fpath, 'r', encoding='utf-8') as f:
    for line_num, line in enumerate(f):
        line = line.strip()
        if not line:
            continue
        if 'media_type' not in line:
            continue
        try:
            obj = json.loads(line)
            find_images(obj, line_num)
        except Exception as e:
            print(f'Error on line {line_num}: {e}')

print(f'\nTotal images saved: {len(saved)}')
for p in saved:
    print(p)
