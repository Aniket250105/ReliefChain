import os
import glob

def fix_hovers(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Replace the dark green hover with an opacity hover or a navy hover to match the new Navy backgrounds
    content = content.replace('hover:bg-[#065F46]', 'hover:opacity-90')
    content = content.replace('text-emerald-600', 'text-[#172554]')
    content = content.replace('text-emerald-800', 'text-[#064E3B]')
    content = content.replace('bg-emerald-100', 'bg-[#F8E7C9]')
    content = content.replace('hover:text-emerald-900', 'hover:opacity-80')
    content = content.replace('border-emerald-200', 'border-[#172554]/30')
    content = content.replace('bg-emerald-50', 'bg-white')
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

for filepath in glob.glob('apps/web/src/**/*.tsx', recursive=True):
    if os.path.isfile(filepath):
        fix_hovers(filepath)
