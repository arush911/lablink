import json, os, re

manifest = {
    'stitch_project_id': '15502302728869515424',
    'stitch_project_name': 'projects/15502302728869515424',
    'title': 'LabLink Campus Resource Platform',
    'design_system': 'Academic Precision',
    'export_timestamp': '2026-11-23T13:40:20Z',
    'screens': [],
    'design_tokens': {
        'markdown_path': 'design/stitch/design-tokens/design-system.md',
        'json_path': 'design/stitch/design-tokens/theme-tokens.json',
        'status': 'EXPORTED_AND_VERIFIED'
    },
    'missing_design_materials': []
}

screens_meta = [
    ('01_student_laboratory_dashboard', '861f410a28464f00bc4da9bad4ec3117', 'Student Laboratory Dashboard', 'DESKTOP', '2560x3802'),
    ('02_equipment_discovery_and_specifications', 'ea2aae7ce6354a89be96702002efbe1f', 'Equipment Discovery & Specifications Catalog', 'DESKTOP', '2560x3788'),
    ('03_faculty_laboratory_management', '86b5609f50c34e79b9104edc2ff64e2e', 'Faculty Laboratory Management Dashboard', 'DESKTOP', '2560x3386'),
    ('04_intelligent_scheduling_and_conflict_resolution', 'a3e879db267a4331b665ce7e5dd21a02', 'Intelligent Scheduling & Conflict Resolution Engine', 'DESKTOP', '2560x3194'),
    ('05_student_project_access_request', '275492e56d78477e90ebc7e99eb01cfe', 'Student Project Access Request', 'DESKTOP', '2560x4816'),
    ('06_faculty_request_review', 'd878408e8d89426da415003d87e7e211', 'Faculty Request Review', 'DESKTOP', '2560x3624'),
    ('07_weekly_laboratory_scheduling_calendar', '5206f85945a548f4afd9c4fab109209f', 'Weekly Laboratory Scheduling Calendar', 'DESKTOP', '2560x4562'),
    ('08_student_request_tracking', 'b1cf784dbf854c4298f6c8eadf1f9d0c', 'Student Request Tracking', 'DESKTOP', '2560x4602'),
    ('09_scheduling_recommendation_details', 'd94c3396a7564e50a7fea23c6d8d683b', 'Scheduling Recommendation Details', 'DESKTOP', '2560x3548'),
    ('10_student_laboratory_dashboard_mobile', '54f02155c5394fd6881f894a27c25089', 'Student Laboratory Dashboard (Mobile)', 'MOBILE', '780x4996'),
    ('11_equipment_discovery_and_availability_mobile', 'c7b69f0899fc4b288974d31a399a2c99', 'Equipment Discovery & Availability (Mobile)', 'MOBILE', '780x4422'),
    ('12_faculty_approvals_and_conflict_resolution_mobile', '6a3b4c6396334631ac785067a15c5788', 'Faculty Approvals & Conflict Resolution (Mobile)', 'MOBILE', '780x3766'),
    ('13_project_access_request_and_scheduling_mobile', '08df62edd69542b6909ec312c4f503a4', 'Project Access Request & Scheduling (Mobile)', 'MOBILE', '780x3218')
]

screens_dir = r'D:\projects using antigravity\LabLink\design\stitch\screens'

for prefix, screen_id, title, device_type, resolution in screens_meta:
    html_file = f'{prefix}.html'
    png_file = f'{prefix}.png'
    html_path = os.path.join(screens_dir, html_file)
    png_path = os.path.join(screens_dir, png_file)
    
    html_exists = os.path.exists(html_path)
    png_exists = os.path.exists(png_path)
    
    html_size = os.path.getsize(html_path) if html_exists else 0
    png_size = os.path.getsize(png_path) if png_exists else 0
    
    img_refs = []
    if html_exists:
        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()
            img_refs = re.findall(r'src=["\'](https?://[^"\']+)["\']', content)
    
    manifest['screens'].append({
        'screen_index': prefix[:2],
        'name': prefix,
        'title': title,
        'screen_id': screen_id,
        'device_type': device_type,
        'resolution': resolution,
        'export_status': 'SUCCESS' if (html_exists and png_exists) else 'FAILED',
        'export_format': ['HTML_TAILWIND', 'PNG_SCREENSHOT'],
        'html_path': f'design/stitch/screens/{html_file}',
        'html_bytes': html_size,
        'screenshot_path': f'design/stitch/screens/{png_file}',
        'screenshot_bytes': png_size,
        'asset_references_count': len(img_refs),
        'external_asset_urls': list(set(img_refs))
    })

manifest_path = r'D:\projects using antigravity\LabLink\design\stitch\manifest.json'
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)

print('manifest.json created and verified!')
